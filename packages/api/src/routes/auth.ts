// packages/api/src/routes/auth.ts
import { FastifyInstance } from 'fastify';
import '@fastify/cookie';
import '@fastify/jwt';
import { sql } from 'drizzle-orm';
import { getMasterDb, getTenantDbCached } from '../utils/db.js';
import bcryptjs from 'bcryptjs';
import { z } from 'zod';
import 'dotenv/config';

const { compare } = bcryptjs;

// ── In-memory brute force tracker ────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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

// ── Revoked refresh tokens ────────────────────────────────────
const revokedTokens = new Set<string>();

// ── Cookie config ─────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';
const ACCESS_COOKIE = {
  name: 'accessToken',
  options: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? 'none' : 'strict') as 'none' | 'strict',
    path: '/',
    maxAge: 30 * 60,
  },
};
const REFRESH_COOKIE = {
  name: 'refreshToken',
  options: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? 'none' : 'strict') as 'none' | 'strict',
    path: '/api/auth',
    maxAge: 24 * 60 * 60,
  },
};

const REFRESH_COOKIE_REMEMBER = {
  ...REFRESH_COOKIE,
  options: {
    ...REFRESH_COOKIE.options,
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
};

// ── Schemas ───────────────────────────────────────────────────
const loginSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export async function authRoutes(app: FastifyInstance) {

  // ── POST /api/auth/login ─────────────────────────────
  app.post('/login', async (request, reply) => {
    const ip = request.ip;

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

    // Use master DB singleton — prevents cold start on every login
    const masterDb = getMasterDb();

    const restaurantResult = await masterDb.execute(
      sql`SELECT id, name, slug, neon_connection_string, status FROM restaurants WHERE slug = ${restaurantSlug} LIMIT 1`
    );

    const restaurant = restaurantResult.rows[0];

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

    // Use cached tenant connection — one connection per restaurant
    const tenantDb = getTenantDbCached(
      restaurant.id as string,
      restaurant.neon_connection_string as string
    );

    const userResult = await tenantDb.execute(
      sql`SELECT id, waiter_number, name, role, password_hash, is_active FROM users WHERE waiter_number = ${waiterNumber} LIMIT 1`
    );

    const user = userResult.rows[0];

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

    const passwordValid = await compare(password, user.password_hash as string);
    if (!passwordValid) {
      recordFailedAttempt(ip);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    clearAttempts(ip);

    const tokenPayload = {
      userId: user.id as string,
      restaurantId: restaurant.id as string,
      restaurantSlug: restaurant.slug as string,
      role: user.role as string,
    };

    const accessToken = app.jwt.sign(tokenPayload, { expiresIn: '30m' });
    const refreshToken = app.jwt.sign(
      { ...tokenPayload, type: 'refresh' },
      { expiresIn: rememberMe ? '30d' : '24h' }
    );

    // ── Set HttpOnly cookies ──────────────────────────
    reply.setCookie(ACCESS_COOKIE.name, accessToken, ACCESS_COOKIE.options);
    reply.setCookie(
      REFRESH_COOKIE.name,
      refreshToken,
      rememberMe ? REFRESH_COOKIE_REMEMBER.options : REFRESH_COOKIE.options
    );

    // ── Return only non-sensitive user info ───────────
    return reply.send({
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

  // ── POST /api/auth/refresh ───────────────────────────
  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
    }

    if (revokedTokens.has(refreshToken)) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token has been revoked',
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
      const newRefreshToken = app.jwt.sign(
        { ...tokenPayload, type: 'refresh' },
        { expiresIn: '24h' }
      );

      // Revoke old refresh token
      revokedTokens.add(refreshToken);

      reply.setCookie(ACCESS_COOKIE.name, newAccessToken, ACCESS_COOKIE.options);
      reply.setCookie(REFRESH_COOKIE.name, newRefreshToken, REFRESH_COOKIE.options);

      return reply.send({ success: true });
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });

  // ── POST /api/auth/logout ────────────────────────────
  app.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken;

    if (refreshToken) {
      try {
        const decoded = app.jwt.verify(refreshToken) as { type?: string };
        if (decoded.type === 'refresh') {
          revokedTokens.add(refreshToken);
          if (revokedTokens.size > 10000) {
            const first = revokedTokens.values().next().value;
            if (first) revokedTokens.delete(first);
          }
        }
      } catch {
        // Already expired — nothing to revoke
      }
    }

    // Clear both cookies
    reply.clearCookie(ACCESS_COOKIE.name, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE.name, { path: '/api/auth' });

    return reply.send({ success: true });
  });
}
