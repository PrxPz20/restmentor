import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import 'dotenv/config';

async function getTenantDbFromToken(app: FastifyInstance, request: any) {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) throw new Error('MASTER_DATABASE_URL not set');

  const decoded = await request.jwtVerify() as {
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

const addItemSchema = z.object({
  menuItemId: z.string().uuid(),
  genderTarget: z.enum(['male', 'female', 'kid', 'shared']),
  quantity: z.number().min(1).default(1),
  notes: z.string().nullable().optional(),
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
            ) FILTER (WHERE oi.id IS NOT NULL),
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

      // Get next round number
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

      // Check if same item already exists in this order for same gender
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
}
