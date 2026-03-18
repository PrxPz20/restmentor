import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
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

export async function tableRoutes(app: FastifyInstance) {

  // ── GET /api/tables ─────────────────────────────────
  app.get('/', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);

      const result = await db.execute(
        sql`SELECT id, label, status, current_session_id, sort_order FROM tables ORDER BY sort_order ASC`
      );

      return reply.send({ tables: result.rows });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch tables' });
    }
  });

  // ── PATCH /api/tables/:id/status ────────────────────
  app.patch('/:id/status', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };

      const validStatuses = ['open', 'occupied', 'paid', 'cleaning'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      await db.execute(
        sql`UPDATE tables SET status = ${status}, updated_at = now() WHERE id = ${id}`
      );

      return reply.send({ success: true, tableId: id, newStatus: status });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update table status' });
    }
  });
}
