// packages/api/src/utils/tenant.ts
import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

export interface DecodedToken {
  userId: string;
  restaurantId: string;
  restaurantSlug: string;
  role: string;
}

export async function getTenantDb(app: FastifyInstance, request: any): Promise<{ db: ReturnType<typeof drizzle>; decoded: DecodedToken }> {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) throw new Error('MASTER_DATABASE_URL not set');

  const token = request.cookies?.accessToken;
  if (!token) throw Object.assign(new Error('Missing token'), { code: 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' });

  const decoded = app.jwt.verify(token) as DecodedToken;

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

export function handleRouteError(err: any, reply: any, app: FastifyInstance, message: string) {
  if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing authorization token' });
  }
  app.log.error(err);
  return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message });
}
