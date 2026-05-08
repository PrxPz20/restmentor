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
import { getTenantDb, handleRouteError } from '../utils/tenant.js';

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


// Routes under /api/tables prefix
export async function tableSessionRoutes(app: FastifyInstance) {

  // ── POST /api/tables/:id/sessions ───────────────────
  app.post('/:id/sessions', async (request, reply) => {
    try {
      const { db, decoded } = await getTenantDb(app, request);
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
      return handleRouteError(err, reply, app, 'Failed to create session');
    }
  });
}

// Routes under /api/sessions prefix
export async function sessionRoutes(app: FastifyInstance) {

  // ── PATCH /api/sessions/:id/guests ──────────────────
  app.patch('/:id/guests', async (request, reply) => {
    try {
      const { db } = await getTenantDb(app, request);
      const { id } = request.params as { id: string };

      const schema = z.object({
        guestMales: z.number().min(0),
        guestFemales: z.number().min(0),
        guestKids: z.number().min(0),
      }).refine(d => d.guestMales + d.guestFemales + d.guestKids > 0, {
        message: 'At least one guest is required',
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid input',
        });
      }

      const { guestMales, guestFemales, guestKids } = parsed.data;

      await db.execute(
        sql`UPDATE table_sessions SET
            guest_males = ${guestMales},
            guest_females = ${guestFemales},
            guest_kids = ${guestKids}
            WHERE id = ${id}`
      );

      return reply.send({ success: true, guestMales, guestFemales, guestKids });
    } catch (err: any) {
      return handleRouteError(err, reply, app, 'Failed to update guests');
    }
  });

  // ── GET /api/sessions/:id ───────────────────────────
  app.get('/:id', async (request, reply) => {
    try {
      const { db } = await getTenantDb(app, request);
      const { id } = request.params as { id: string };

      const result = await db.execute(
        sql`SELECT
              ts.id, ts.table_id, ts.waiter_id,
              ts.guest_males, ts.guest_females, ts.guest_kids,
              ts.opened_at, ts.paid_at, ts.closed_at,
              t.label AS table_label
            FROM table_sessions ts
            JOIN tables t ON t.id = ts.table_id
            WHERE ts.id = ${id}
            LIMIT 1`
      );

      const session = result.rows[0];
      if (!session) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Session not found' });
      }

      return reply.send({ session });
    } catch (err: any) {
      return handleRouteError(err, reply, app, 'Failed to fetch session');
    }
  });
}
