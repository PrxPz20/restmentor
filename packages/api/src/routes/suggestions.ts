// packages/api/src/routes/suggestions.ts
import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import '@fastify/cookie';
import '@fastify/jwt';
import { z } from 'zod';
import 'dotenv/config';
import { getAISuggestions } from '../services/ai.service.js';

async function getTenantDbFromToken(app: FastifyInstance, request: any) {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) throw new Error('MASTER_DATABASE_URL not set');

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

export async function suggestionRoutes(app: FastifyInstance) {

  // ── POST /api/sessions/:id/suggestions ──────────────────────
  app.post('/:sessionId/suggestions', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { sessionId } = request.params as { sessionId: string };

      const bodySchema = z.object({
        lastAddedItem: z.object({
          name: z.string(),
          genderTarget: z.string(),
        }),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid input' });
      }

      const { lastAddedItem } = parsed.data;

      // ── Fetch session details ──────────────────────────────
      const sessionResult = await db.execute(
        sql`SELECT guest_males, guest_females, guest_kids FROM table_sessions WHERE id = ${sessionId} LIMIT 1`
      );
      const session = sessionResult.rows[0];
      if (!session) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });

      // ── Fetch all ordered items for this session ───────────
      const orderedResult = await db.execute(
        sql`SELECT oi.menu_item_id, mi.name, oi.quantity, oi.gender_target
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE o.session_id = ${sessionId}
            AND oi.quantity > 0`
      );

      const orderedItems = orderedResult.rows.map((row: any) => ({
        menuItemId: row.menu_item_id,
        name: row.name,
        quantity: row.quantity,
        genderTarget: row.gender_target,
      }));

      // ── Fetch full menu ────────────────────────────────────
      const menuResult = await db.execute(
        sql`SELECT mi.id, mi.name, mi.description, mi.price, mi.destination, mc.name as category
            FROM menu_items mi
            JOIN menu_categories mc ON mc.id = mi.category_id
            WHERE mi.is_active = true
            ORDER BY mc.sort_order, mi.name`
      );

      const menu = menuResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        category: row.category,
        destination: row.destination,
      }));

      if (menu.length === 0) {
        return reply.send({ suggestions: [] });
      }

      // ── Get ordered item IDs to exclude from suggestions ──
      const orderedItemIds = new Set(orderedItems.map(i => i.menuItemId));
      const filteredMenu = menu.filter(m => !orderedItemIds.has(m.id));

      // ── Call AI ────────────────────────────────────────────
      const suggestions = await getAISuggestions({
        menu: filteredMenu,
        guestMales: session.guest_males as number,
        guestFemales: session.guest_females as number,
        guestKids: session.guest_kids as number,
        orderedItems,
        lastAddedItem,
      });

      // ── Log suggestion to DB ───────────────────────────────
      if (suggestions.length > 0) {
        await db.execute(
          sql`INSERT INTO ai_suggestions (session_id, round_context, suggested_items, reasoning, accepted_item_ids)
              VALUES (
                ${sessionId},
                ${JSON.stringify({ orderedItems, lastAddedItem })}::jsonb,
                ${JSON.stringify(suggestions.map(s => ({ itemId: s.itemId, itemName: s.itemName, price: s.price, target: s.target })))}::jsonb,
                ${JSON.stringify(suggestions.map(s => ({ itemId: s.itemId, reasons: s.reasons })))}::jsonb,
                '[]'::jsonb
              )`
        );
      }

      return reply.send({ suggestions });

    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to get suggestions' });
    }
  });
}
