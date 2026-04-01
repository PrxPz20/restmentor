// packages/api/src/routes/auth.ts
import { FastifyInstance } from 'fastify';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import { z } from 'zod';
import 'dotenv/config';

const { compare } = bcryptjs;

// ── In-memory brute force tracker ────────────────────────────
// Tracks failed login attempts per IP. Resets on successful login.
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ── Refresh token blocklist (revoked tokens) ──────────────────
// In-memory for now — survives process lifetime, sufficient for MVP
const revokedTokens = new Set<string>();

function isRateLimited(ip: string): { limited: boolean; retryAfterSeconds?: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { limited: false };
  if (record.lockedUntil > Date.now()) {
    return { limited: true, retryAfterSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000) };
  }
  return { limited: false };
}

function recordFailedAttempt(ip: string) {
  const record = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(ip, record);
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// ── Schemas ──────────────────────────────────────────────────
const loginSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export async function authRoutes(app: FastifyInstance) {

  // ── POST /api/auth/login ────────────────────────────
  app.post('/login', async (request, reply) => {
    const ip = request.ip;

    // ── Brute force check ──
    const { limited, retryAfterSeconds } = isRateLimited(ip);
    if (limited) {
      reply.header('Retry-After', String(retryAfterSeconds));
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Account locked due to too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds! / 60)} minutes.`,
      });
    }

    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }

    const { accountNumber, password, rememberMe } = parsed.data;

    // ── Parse account number ──
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

    // ── Look up restaurant in master DB ──
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

    // ── Use generic error to prevent restaurant enumeration ──
    if (!restaurant) {
      recordFailedAttempt(ip);
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

    // ── Connect to tenant DB ──
    const tenantClient = neon(restaurant.neon_connection_string as string);
    const tenantDb = drizzle(tenantClient);

    const userResult = await tenantDb.execute(
      sql`SELECT id, waiter_number, name, role, password_hash, is_active FROM users WHERE waiter_number = ${waiterNumber} LIMIT 1`
    );

    const user = userResult.rows[0];

    // ── Generic error prevents waiter number enumeration ──
    if (!user) {
      recordFailedAttempt(ip);
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

    // ── Verify password ──
    const passwordValid = await compare(password, user.password_hash as string);
    if (!passwordValid) {
      recordFailedAttempt(ip);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    // ── Success: clear brute force record ──
    clearAttempts(ip);

    const tokenPayload = {
      userId: user.id as string,
      restaurantId: restaurant.id as string,
      restaurantSlug: restaurant.slug as string,
      role: user.role as string,
    };

    // Access token is always short-lived (30m)
    // rememberMe only affects how long the refresh token lasts
    const accessToken = app.jwt.sign(tokenPayload, { expiresIn: '30m' });
    const refreshToken = app.jwt.sign(
      { ...tokenPayload, type: 'refresh' },
      { expiresIn: rememberMe ? '30d' : '24h' }
    );

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


  // ── POST /api/auth/logout ───────────────────────────
  app.post('/logout', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      // Still return 200 — client should clear tokens regardless
      return reply.send({ success: true });
    }

    const { refreshToken } = parsed.data;

    try {
      const decoded = app.jwt.verify(refreshToken) as { type?: string };
      if (decoded.type === 'refresh') {
        revokedTokens.add(refreshToken);
        // Clean up expired tokens periodically to prevent memory leak
        if (revokedTokens.size > 10000) {
          const first = revokedTokens.values().next().value;
          if (first) revokedTokens.delete(first);
        }
      }
    } catch {
      // Token already expired — nothing to revoke
    }

    return reply.send({ success: true });
  });


  // ── POST /api/auth/refresh ──────────────────────────
  app.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }

    const { refreshToken } = parsed.data;

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

      if (revokedTokens.has(refreshToken)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token has been revoked',
        });
      }

      const tokenPayload = {
        userId: decoded.userId,
        restaurantId: decoded.restaurantId,
        restaurantSlug: decoded.restaurantSlug,
        role: decoded.role,
      };

      const newAccessToken = app.jwt.sign(tokenPayload, { expiresIn: '30m' });
      const newRefreshToken = app.jwt.sign(
        { ...tokenPayload, type: 'refresh' },
        { expiresIn: '24h' }
      );

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
