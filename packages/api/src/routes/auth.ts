import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import { z } from 'zod';
import 'dotenv/config';

const { compare } = bcryptjs;

const loginSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export async function authRoutes(app: FastifyInstance) {

  // ── POST /api/auth/login ────────────────────────────
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }

    const { accountNumber, password, rememberMe } = parsed.data;

    // Parse account number: RestaurantSlug/WaiterNumber
    const slashIndex = accountNumber.indexOf('/');
    if (slashIndex === -1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Account number must be in format: RestaurantName/WaiterNumber',
      });
    }

    const restaurantSlug = accountNumber.substring(0, slashIndex).toLowerCase();
    const waiterNumber = accountNumber.substring(slashIndex + 1);

    if (!restaurantSlug || !waiterNumber) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Account number must be in format: RestaurantName/WaiterNumber',
      });
    }

    // Look up restaurant in master DB
    const masterUrl = process.env.MASTER_DATABASE_URL;
    if (!masterUrl) {
      app.log.error('MASTER_DATABASE_URL is not set');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Server configuration error',
      });
    }

    const masterClient = neon(masterUrl);
    const masterDb = drizzle(masterClient);

    const restaurantResult = await masterDb.execute(
      sql`SELECT id, name, slug, neon_connection_string, status FROM restaurants WHERE slug = ${restaurantSlug} LIMIT 1`
    );

    const restaurant = restaurantResult.rows[0];
    if (!restaurant) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    if (restaurant.status === 'suspended') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This restaurant account has been suspended',
      });
    }

    // Connect to tenant DB
    const tenantClient = neon(restaurant.neon_connection_string as string);
    const tenantDb = drizzle(tenantClient);

    // Find waiter
    const userResult = await tenantDb.execute(
      sql`SELECT id, waiter_number, name, role, password_hash, is_active FROM users WHERE waiter_number = ${waiterNumber} LIMIT 1`
    );

    const user = userResult.rows[0];
    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    if (!user.is_active) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This account has been deactivated',
      });
    }

    // Verify password
    const passwordValid = await compare(password, user.password_hash as string);
    if (!passwordValid) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // Generate JWT
    const tokenPayload = {
      userId: user.id as string,
      restaurantId: restaurant.id as string,
      restaurantSlug: restaurant.slug as string,
      role: user.role as string,
    };

    const accessToken = app.jwt.sign(tokenPayload, { expiresIn: rememberMe ? '7d' : '30m' });
    const refreshToken = app.jwt.sign({ ...tokenPayload, type: 'refresh' }, { expiresIn: '30d' });

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        waiterNumber: user.waiter_number,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
    });
  });

  // ── POST /api/auth/refresh ──────────────────────────
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    if (!refreshToken) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    try {
      const decoded = app.jwt.verify(refreshToken) as {
        userId: string;
        restaurantId: string;
        restaurantSlug: string;
        role: string;
        type?: string;
      };

      if (decoded.type !== 'refresh') {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid refresh token',
        });
      }

      const tokenPayload = {
        userId: decoded.userId,
        restaurantId: decoded.restaurantId,
        restaurantSlug: decoded.restaurantSlug,
        role: decoded.role,
      };

      const newAccessToken = app.jwt.sign(tokenPayload, { expiresIn: '30m' });
      const newRefreshToken = app.jwt.sign({ ...tokenPayload, type: 'refresh' }, { expiresIn: '30d' });

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });
}
