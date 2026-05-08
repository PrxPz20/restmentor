// packages/api/src/utils/tenant.ts
import { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { getMasterDb, getTenantDbCached } from './db.js';
import 'dotenv/config';

export interface DecodedToken {
  userId: string;
  restaurantId: string;
  restaurantSlug: string;
  role: string;
}

export async function getTenantDb(
  app: FastifyInstance,
  request: any
): Promise<{ db: ReturnType<typeof drizzle>; decoded: DecodedToken }> {
  const token = request.cookies?.accessToken;
  if (!token) {
    throw Object.assign(new Error('Missing token'), { code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' });
  }

  const decoded = app.jwt.verify(token) as DecodedToken;

  // Use master DB singleton — no cold start on every request
  const masterDb = getMasterDb();

  const result = await masterDb.execute(
    sql`SELECT neon_connection_string FROM restaurants WHERE id = ${decoded.restaurantId} AND status = 'active' LIMIT 1`
  );

  const restaurant = result.rows[0];
  if (!restaurant) throw new Error('Restaurant not found or suspended');

  // Use cached tenant connection — no new connection object per request
  const db = getTenantDbCached(
    decoded.restaurantId,
    restaurant.neon_connection_string as string
  );

  return { db, decoded };
}

export function handleRouteError(
  err: any,
  reply: any,
  app: FastifyInstance,
  message: string
) {
  if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing authorization token',
    });
  }
  app.log.error(err);
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message,
  });
}
