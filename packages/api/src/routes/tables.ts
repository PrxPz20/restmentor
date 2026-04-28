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

      await db.execute(
        sql`UPDATE tables SET status = ${status}, updated_at = now() WHERE id = ${id}`
      );

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
