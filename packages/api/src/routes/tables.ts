// restmentor/packages/api/src/routes/tables.ts
import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import '@fastify/cookie';
import '@fastify/jwt';
import 'dotenv/config';
import { z } from 'zod';
import type { Server as SocketIOServer } from 'socket.io';
import { getTenantDb, handleRouteError } from '../utils/tenant.js';
import { neon as masterNeon } from '@neondatabase/serverless';
import { drizzle as masterDrizzle } from 'drizzle-orm/neon-http';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}


export async function tableRoutes(app: FastifyInstance) {

  // ── GET /api/tables ─────────────────────────────────
  app.get('/', async (request, reply) => {
    try {
      const { db } = await getTenantDb(app, request);

      const result = await db.execute(
        sql`SELECT id, label, status, current_session_id, sort_order FROM tables ORDER BY sort_order ASC`
      );

      return reply.send({ tables: result.rows });
    } catch (err: any) {
      return handleRouteError(err, reply, app, 'Failed to fetch tables');
    }
  });

  // ── PATCH /api/tables/:id/status ────────────────────
  app.patch('/:id/status', async (request, reply) => {
    try {
      const { db, decoded } = await getTenantDb(app, request);
      const { id } = request.params as { id: string };

      const statusSchema = z.object({
        status: z.enum(['open', 'occupied', 'paid', 'cleaning'], {
          errorMap: () => ({ message: 'Status must be one of: open, occupied, paid, cleaning' }),
        }),
      });

      const parsed = statusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid input',
        });
      }

      const { status } = parsed.data;

      // ── Get current table state before update ─────────────
      const tableResult = await db.execute(
        sql`SELECT current_session_id, status as current_status FROM tables WHERE id = ${id} LIMIT 1`
      );
      const table = tableResult.rows[0];
      const currentSessionId = table?.current_session_id as string | null;
      const previousStatus = table?.current_status as string | null;

      // ── Update table status ───────────────────────────────
      if (status === 'open') {
        await db.execute(
          sql`UPDATE tables SET status = ${status}, updated_at = now(), current_session_id = NULL WHERE id = ${id}`
        );
      } else {
        await db.execute(
          sql`UPDATE tables SET status = ${status}, updated_at = now() WHERE id = ${id}`
        );
      }

      // ── Commission logic ──────────────────────────────────
      if (currentSessionId) {
        const masterUrl = process.env.MASTER_DATABASE_URL!;
        const masterDb = masterDrizzle(masterNeon(masterUrl));

        if (status === 'paid') {
          // Get restaurant commission rate
          const restaurantResult = await masterDb.execute(
            sql`SELECT commission_rate FROM restaurants WHERE id = ${decoded.restaurantId} LIMIT 1`
          );
          const commissionRate = Number(restaurantResult.rows[0]?.commission_rate ?? 0.10);

          // Get all AI-suggested items for this session
          const aiItemsResult = await db.execute(
            sql`SELECT oi.id, mi.price, mi.name
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                JOIN menu_items mi ON mi.id = oi.menu_item_id
                WHERE o.session_id = ${currentSessionId}
                AND oi.ai_suggested = true
                AND oi.quantity > 0`
          );

          // Insert one commission record per AI item
          for (const item of aiItemsResult.rows) {
            const itemPrice = Number(item.price);
            const commissionAmount = Number((itemPrice * commissionRate).toFixed(2));
            await masterDb.execute(
              sql`INSERT INTO commission_ledger
                  (restaurant_id, session_ref, order_item_ref, item_price, commission_rate, commission_amount, status, confirmed_at)
                  VALUES (
                    ${decoded.restaurantId},
                    ${currentSessionId},
                    ${item.id as string},
                    ${itemPrice},
                    ${commissionRate},
                    ${commissionAmount},
                    'confirmed',
                    now()
                  )`
            );
          }

          // Mark session as paid
          await db.execute(
            sql`UPDATE table_sessions SET paid_at = now() WHERE id = ${currentSessionId}`
          );

          app.log.info(`Commission calculated for session ${currentSessionId} — ${aiItemsResult.rows.length} AI items`);

          // ── Analytics tracking ────────────────────────────────
          // Get session guest composition
          const sessionResult = await db.execute(
            sql`SELECT guest_males, guest_females, guest_kids FROM table_sessions WHERE id = ${currentSessionId} LIMIT 1`
          );
          const session = sessionResult.rows[0];
          if (session) {
            const males = Number(session.guest_males);
            const females = Number(session.guest_females);
            const kids = Number(session.guest_kids);
            const totalGuests = males + females + kids;

            // Update gender stats — always one row, created during migration
            await db.execute(
              sql`UPDATE restaurant_gender_stats SET
                    total_males = total_males + ${males},
                    total_females = total_females + ${females},
                    total_kids = total_kids + ${kids},
                    total_guests = total_guests + ${totalGuests},
                    updated_at = now()`
            );

            // Get all order items for this session with gender and ai flag
            const allItemsResult = await db.execute(
              sql`SELECT oi.menu_item_id, oi.gender_target, oi.quantity, oi.ai_suggested
                  FROM orders o
                  JOIN order_items oi ON oi.order_id = o.id
                  WHERE o.session_id = ${currentSessionId}
                  AND oi.quantity > 0`
            );

            // Upsert item stats per (menu_item_id, gender_target)
            for (const item of allItemsResult.rows) {
              const qty = Number(item.quantity);
              const aiQty = item.ai_suggested ? qty : 0;
              await db.execute(
                sql`INSERT INTO restaurant_item_stats (menu_item_id, gender_target, total_quantity, ai_suggested_quantity)
                    VALUES (${item.menu_item_id as string}, ${item.gender_target as string}, ${qty}, ${aiQty})
                    ON CONFLICT (menu_item_id, gender_target) DO UPDATE SET
                      total_quantity = restaurant_item_stats.total_quantity + ${qty},
                      ai_suggested_quantity = restaurant_item_stats.ai_suggested_quantity + ${aiQty},
                      updated_at = now()`
              );
            }

            app.log.info(`Analytics tracked for session ${currentSessionId} — ${allItemsResult.rows.length} items, ${totalGuests} guests`);
          }

        } else if (previousStatus === 'paid' && status === 'occupied') {
          // Only reverse commissions if explicitly going back to occupied (waiter mistake)
          // Normal flow paid → cleaning → open does NOT reverse commissions
          await masterDb.execute(
            sql`DELETE FROM commission_ledger WHERE session_ref = ${currentSessionId}`
          );
          await db.execute(
            sql`UPDATE table_sessions SET paid_at = null WHERE id = ${currentSessionId}`
          );
          app.log.info(`Commissions reversed for session ${currentSessionId} — reverted to occupied`);
        }
      }

      app.io.to(`restaurant:${decoded.restaurantId}`).emit('table:status_changed', {
        tableId: id,
        newStatus: status,
      });

      return reply.send({ success: true, tableId: id, newStatus: status });
    } catch (err: any) {
      return handleRouteError(err, reply, app, 'Failed to update table status');
    }
  });
}
