// restmentor/packages/api/src/routes/orders.ts
import { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import '@fastify/cookie';
import '@fastify/jwt';
import { z } from 'zod';
import 'dotenv/config';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

// ── In-memory modification tracker (per session) ─────────────
// Tracks what actually changed since last send, so we only emit deltas
interface ModificationEntry {
  itemId: string;
  itemName: string;
  destination: string;
  newQuantity: number;
  action: 'removed' | 'quantity_updated';
  roundNumber: number;
}

const sessionModifications = new Map<string, ModificationEntry[]>();

// ── Tenant DB helper ─────────────────────────────────────────
async function getTenantDbFromToken(app: FastifyInstance, request: any) {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) throw new Error('MASTER_DATABASE_URL not set');

  // Read token from HttpOnly cookie explicitly
  const token = request.cookies?.accessToken;
  if (!token) throw Object.assign(new Error('Missing token'), { code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' });

  const decoded = app.jwt.verify(token) as {
    userId: string;
    restaurantId: string;
    restaurantSlug: string;
    role: string;
  };

  const masterClient = neon(masterUrl);
  const masterDb = drizzle(masterClient);

  const result = await masterDb.execute(
    sql`SELECT neon_connection_string FROM restaurants WHERE id = ${decoded.restaurantId} AND status = 'active' LIMIT 1`
  );

  const restaurant = result.rows[0];
  if (!restaurant) throw new Error('Restaurant not found');

  const tenantClient = neon(restaurant.neon_connection_string as string);
  return { db: drizzle(tenantClient), decoded };
}

// ── Validation schemas ───────────────────────────────────────
const addItemSchema = z.object({
  menuItemId: z.string().uuid(),
  genderTarget: z.enum(['male', 'female', 'kid', 'shared']),
  quantity: z.number().min(1).default(1),
  notes: z.string().nullable().optional(),
});

const editItemSchema = z.object({
  quantity: z.number().min(0),
});

export async function orderRoutes(app: FastifyInstance) {

  // ── GET /api/sessions/:sessionId/orders ─────────────
  app.get('/sessions/:sessionId/orders', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { sessionId } = request.params as { sessionId: string };

      const ordersResult = await db.execute(sql`
        SELECT o.id, o.round_number, o.status, o.created_at, o.sent_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'menuItemId', oi.menu_item_id,
                'menuItemName', mi.name,
                'menuItemPrice', mi.price,
                'genderTarget', oi.gender_target,
                'quantity', oi.quantity,
                'aiSuggested', oi.ai_suggested,
                'notes', oi.notes
              )
            ) FILTER (WHERE oi.id IS NOT NULL AND oi.quantity > 0),
            '[]'
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.session_id = ${sessionId}
        GROUP BY o.id
        ORDER BY o.round_number ASC
      `);

      return reply.send({ orders: ordersResult.rows });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch orders' });
    }
  });

  // ── POST /api/sessions/:sessionId/orders ────────────
  app.post('/sessions/:sessionId/orders', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { sessionId } = request.params as { sessionId: string };

      const roundResult = await db.execute(sql`
        SELECT COALESCE(MAX(round_number), 0) + 1 as next_round
        FROM orders WHERE session_id = ${sessionId}
      `);
      const nextRound = roundResult.rows[0]!.next_round as number;

      const orderResult = await db.execute(sql`
        INSERT INTO orders (session_id, round_number, status)
        VALUES (${sessionId}, ${nextRound}, 'draft')
        RETURNING id, round_number, status, created_at
      `);

      return reply.send({ order: orderResult.rows[0] });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create order' });
    }
  });

  // ── POST /api/orders/:orderId/items ─────────────────
  app.post('/orders/:orderId/items', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { orderId } = request.params as { orderId: string };

      const parsed = addItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid input',
        });
      }

      const { menuItemId, genderTarget, quantity, notes } = parsed.data;

      const existing = await db.execute(sql`
        SELECT id, quantity FROM order_items
        WHERE order_id = ${orderId} AND menu_item_id = ${menuItemId} AND gender_target = ${genderTarget}
        LIMIT 1
      `);

      if (existing.rows.length > 0) {
        const existingItem = existing.rows[0]!;
        const newQty = (existingItem.quantity as number) + quantity;
        await db.execute(sql`
          UPDATE order_items SET quantity = ${newQty}, updated_at = now()
          WHERE id = ${existingItem.id}
        `);
        return reply.send({ itemId: existingItem.id, quantity: newQty, action: 'updated' });
      }

      const itemResult = await db.execute(sql`
        INSERT INTO order_items (order_id, menu_item_id, gender_target, quantity, notes)
        VALUES (${orderId}, ${menuItemId}, ${genderTarget}, ${quantity}, ${notes ?? null})
        RETURNING id
      `);

      return reply.send({ itemId: itemResult.rows[0]!.id, quantity, action: 'created' });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to add item' });
    }
  });

  // ── PATCH /api/orders/:orderId/items/:itemId ─────────
  app.patch('/orders/:orderId/items/:itemId', async (request, reply) => {
    try {
      const { db, decoded } = await getTenantDbFromToken(app, request);
      const { orderId, itemId } = request.params as { orderId: string; itemId: string };

      const parsed = editItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid input',
        });
      }

      const { quantity } = parsed.data;

      // ── Get order + session + item details in one query ──
      const detailResult = await db.execute(sql`
        SELECT o.id as order_id, o.round_number, o.status, o.session_id,
          ts.table_id, t.label as table_label,
          oi.quantity as current_quantity,
          mi.name as menu_item_name, mi.destination
        FROM orders o
        JOIN table_sessions ts ON ts.id = o.session_id
        JOIN tables t ON t.id = ts.table_id
        JOIN order_items oi ON oi.id = ${itemId} AND oi.order_id = o.id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.id = ${orderId}
        LIMIT 1
      `);

      const detail = detailResult.rows[0];
      if (!detail) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order or item not found' });
      }

      // ── Apply the change ──
      if (quantity === 0) {
        // Soft delete: set quantity to 0, keep row for audit
        await db.execute(sql`
          UPDATE order_items SET quantity = 0, updated_at = now() WHERE id = ${itemId}
        `);
      } else {
        await db.execute(sql`
          UPDATE order_items SET quantity = ${quantity}, updated_at = now() WHERE id = ${itemId}
        `);
      }

      // ── Mark order as modified if it was already sent ──
      if (detail.status === 'sent') {
        await db.execute(sql`
          UPDATE orders SET status = 'modified' WHERE id = ${orderId}
        `);
      }

      // ── Track modification in memory for next Process Order emit ──
      // Only track modifications to previously sent orders (not draft edits)
      if (detail.status === 'sent' || detail.status === 'modified') {
        const sessionId = detail.session_id as string;
        const existing = sessionModifications.get(sessionId) || [];

        // Overwrite any previous tracking for this item — only final state matters
        const filtered = existing.filter(m => m.itemId !== itemId);
        filtered.push({
          itemId,
          itemName: detail.menu_item_name as string,
          destination: detail.destination as string,
          newQuantity: quantity,
          action: quantity === 0 ? 'removed' : 'quantity_updated',
          roundNumber: detail.round_number as number,
        });

        sessionModifications.set(sessionId, filtered);
        app.log.info(`Tracked modification for session ${sessionId}: ${detail.menu_item_name} → qty ${quantity}`);
      }

      return reply.send({ success: true, itemId, quantity });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to edit item' });
    }
  });

  // ── GET /api/menu ───────────────────────────────────
  app.get('/menu', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);

      const categories = await db.execute(sql`
        SELECT id, name, sort_order FROM menu_categories WHERE is_active = true ORDER BY sort_order ASC
      `);

      const items = await db.execute(sql`
        SELECT id, category_id, name, description, price, destination FROM menu_items WHERE is_active = true ORDER BY name ASC
      `);

      const menu = categories.rows.map((cat: any) => ({
        ...cat,
        items: items.rows.filter((item: any) => item.category_id === cat.id),
      }));

      return reply.send({ menu });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch menu' });
    }
  });

  // ── POST /api/orders/:orderId/send ──────────────────
  app.post('/orders/:orderId/send', async (request, reply) => {
    try {
      const { db, decoded } = await getTenantDbFromToken(app, request);
      const { orderId } = request.params as { orderId: string };

      // ── Fetch order + table info ──
      const orderResult = await db.execute(sql`
        SELECT o.id, o.session_id, o.round_number, o.status,
          ts.table_id, t.label as table_label
        FROM orders o
        JOIN table_sessions ts ON ts.id = o.session_id
        JOIN tables t ON t.id = ts.table_id
        WHERE o.id = ${orderId}
        LIMIT 1
      `);

      const order = orderResult.rows[0];
      if (!order) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Order not found' });
      }

      if (order.status === 'sent') {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Order already sent' });
      }

      // ── Count new items in this draft order ──
      const itemsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM order_items
        WHERE order_id = ${orderId} AND quantity > 0
      `);

      const itemCount = Number(itemsResult.rows[0]!.count);
      const sessionId = order.session_id as string;
      const pendingMods = sessionModifications.get(sessionId) || [];

      // ── If in-memory map is empty, check DB for modified orders ──
      // (handles server restart case where in-memory map was cleared)
      if (pendingMods.length === 0) {
        const dbModified = await db.execute(sql`
          SELECT COUNT(*) as count FROM orders
          WHERE session_id = ${sessionId} AND status = 'modified'
        `);
        const dbModCount = Number(dbModified.rows[0]!.count);
        if (dbModCount > 0) {
          app.log.info(`In-memory map empty but found ${dbModCount} modified orders in DB for session ${sessionId} — rebuilding from DB`);
          const rebuiltMods = await db.execute(sql`
            SELECT oi.id as item_id, mi.name as item_name, mi.destination,
              oi.quantity, o.round_number
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.session_id = ${sessionId} AND o.status = 'modified'
          `);
          for (const row of rebuiltMods.rows) {
            const existing = sessionModifications.get(sessionId) || [];
            existing.push({
              itemId: row.item_id as string,
              itemName: row.item_name as string,
              destination: row.destination as string,
              newQuantity: row.quantity as number,
              action: (row.quantity as number) === 0 ? 'removed' : 'quantity_updated',
              roundNumber: row.round_number as number,
            });
            sessionModifications.set(sessionId, existing);
          }
        }
      }

      // ── Refresh pendingMods after potential DB rebuild ──
      const freshPendingMods = sessionModifications.get(sessionId) || [];

      // ── If draft is empty and no pending modifications → nothing to do ──
      if (itemCount === 0 && freshPendingMods.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Cannot send an empty order' });
      }

      // ── Helper: emit pending modifications ──────────────────────────────
      const emitPendingModifications = () => {
        if (freshPendingMods.length === 0) return;

        // Group by round so each card gets a precise targeted update
        const byRound = new Map<number, typeof freshPendingMods>();
        for (const mod of freshPendingMods) {
          if (!byRound.has(mod.roundNumber)) byRound.set(mod.roundNumber, []);
          byRound.get(mod.roundNumber)!.push(mod);
        }

        for (const [roundNumber, mods] of byRound) {
          const kitchenMods = mods.filter(m => m.destination === 'kitchen');
          const barMods = mods.filter(m => m.destination === 'bar');

          if (kitchenMods.length > 0) {
            app.io.to(`restaurant:${decoded.restaurantId}`).emit('order:modified', {
              tableLabel: order.table_label,
              roundNumber,
              destination: 'kitchen',
              items: kitchenMods,
            });
          }

          if (barMods.length > 0) {
            app.io.to(`restaurant:${decoded.restaurantId}`).emit('order:modified', {
              tableLabel: order.table_label,
              roundNumber,
              destination: 'bar',
              items: barMods,
            });
          }
        }

        sessionModifications.delete(sessionId);
        app.log.info(`Emitted ${pendingMods.length} modification(s) for session ${sessionId}`);
      };

      // ── Case A: Draft has new items → send them + emit any pending mods ──
      if (itemCount > 0) {
        await db.execute(sql`
          UPDATE orders SET status = 'sent', sent_at = now() WHERE id = ${orderId}
        `);

        await db.execute(sql`
          UPDATE tables SET status = 'occupied', updated_at = now()
          WHERE id = ${order.table_id} AND status = 'open'
        `);

        const fullOrder = await db.execute(sql`
          SELECT mi.name as menu_item_name, mi.price as menu_item_price,
            oi.gender_target, oi.quantity, oi.notes, mi.destination
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = ${orderId} AND oi.quantity > 0
        `);

        const kitchenItems = fullOrder.rows.filter((i: any) => i.destination === 'kitchen');
        const barItems = fullOrder.rows.filter((i: any) => i.destination === 'bar');

        // Emit new order to displays
        app.io.to(`restaurant:${decoded.restaurantId}`).emit('order:new', {
          tableId: order.table_id,
          tableLabel: order.table_label,
          roundNumber: order.round_number,
          items: fullOrder.rows.map((i: any) => ({
            name: i.menu_item_name,
            price: Number(i.menu_item_price),
            quantity: i.quantity,
            notes: i.notes ?? null,
            destination: i.destination,
            genderTarget: i.gender_target,
          })),
        });

        // Also emit any pending modifications from previous rounds
        emitPendingModifications();

        return reply.send({
          success: true,
          orderId,
          roundNumber: order.round_number,
          kitchenItems: kitchenItems.length,
          barItems: barItems.length,
          totalItems: itemCount,
        });
      }

      // ── Case B: Draft is empty but has pending modifications → emit only mods ──
      emitPendingModifications();

      return reply.send({
        success: true,
        orderId,
        roundNumber: order.round_number,
        kitchenItems: 0,
        barItems: 0,
        totalItems: 0,
        modificationsOnly: true,
      });

    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to send order' });
    }
  });
}
// END ────────────────────────────────────────────────────────
