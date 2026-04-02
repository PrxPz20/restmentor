// restmentor/packages/api/src/routes/sessions.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import '@fastify/cookie';
import '@fastify/jwt';
import 'dotenv/config';
import { FastifyInstance } from 'fastify';
import type { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

const createSessionSchema = z.object({
  guestMales: z.number().min(0).default(0),
  guestFemales: z.number().min(0).default(0),
  guestKids: z.number().min(0).default(0),
});

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

// Routes under /api/tables prefix
export async function tableSessionRoutes(app: FastifyInstance) {

  // ── POST /api/tables/:id/sessions ───────────────────
  app.post('/:id/sessions', async (request, reply) => {
    try {
      const { db, decoded } = await getTenantDbFromToken(app, request);
      const { id: tableId } = request.params as { id: string };

      const parsed = createSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid input',
        });
      }

      const { guestMales, guestFemales, guestKids } = parsed.data;

      const sessionResult = await db.execute(sql`
        INSERT INTO table_sessions (table_id, waiter_id, guest_males, guest_females, guest_kids)
        VALUES (${tableId}, ${decoded.userId}, ${guestMales}, ${guestFemales}, ${guestKids})
        RETURNING id
      `);

      const sessionId = sessionResult.rows[0]!.id as string;

      await db.execute(sql`
        UPDATE tables SET status = 'occupied', current_session_id = ${sessionId}, updated_at = now() WHERE id = ${tableId}
      `);

      app.io.to(`restaurant:${decoded.restaurantId}`).emit('table:status_changed', {
        tableId,
        newStatus: 'occupied',
      });

      return reply.send({
        sessionId,
        tableId,
        guestMales,
        guestFemales,
        guestKids,
      });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create session' });
    }
  });
}

// Routes under /api/sessions prefix
export async function sessionRoutes(app: FastifyInstance) {

  // ── GET /api/sessions/:id ───────────────────────────
  app.get('/:id', async (request, reply) => {
    try {
      const { db } = await getTenantDbFromToken(app, request);
      const { id } = request.params as { id: string };

      const result = await db.execute(
        sql`SELECT id, table_id, waiter_id, guest_males, guest_females, guest_kids, opened_at, paid_at, closed_at FROM table_sessions WHERE id = ${id} LIMIT 1`
      );

      const session = result.rows[0];
      if (!session) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
      }

      return reply.send({ session });
    } catch (err: any) {
      if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
      }
      app.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch session' });
    }
  });
}
