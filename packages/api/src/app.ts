// restmentor/packages/api/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { authRoutes } from './routes/auth.js';
import { tableRoutes } from './routes/tables.js';
import { tableSessionRoutes, sessionRoutes } from './routes/sessions.js';
import { orderRoutes } from './routes/orders.js';
import 'dotenv/config';
import type { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export async function buildApp() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'dev-secret-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    } else {
      console.warn('⚠️  WARNING: JWT_SECRET is not set. Using insecure default — never do this in production.');
    }
  }

  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
    bodyLimit: 1048576, // 1MB max request body
  });

  // ── Security headers ──────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP handled at frontend level
    crossOriginEmbedderPolicy: false,
  });

  // ── CORS ──────────────────────────────────────────────
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  // ── JWT ───────────────────────────────────────────────
  await app.register(jwt, {
    secret: jwtSecret ?? 'dev-secret-change-in-production',
  });

  // ── Global rate limit (all endpoints) ─────────────────
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });

  // ── Health check (no sensitive info exposed) ──────────
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tableRoutes, { prefix: '/api/tables' });
  await app.register(tableSessionRoutes, { prefix: '/api/tables' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(orderRoutes, { prefix: '/api' });

  return app;
}
