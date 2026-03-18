import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import 'dotenv/config';

export async function buildApp() {
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
  });

  // ── CORS ────────────────────────────────────────────
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // ── JWT ─────────────────────────────────────────────
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  });

  // ── Rate Limiting ───────────────────────────────────
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // ── Health Check ────────────────────────────────────
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  });

  // ── Routes ──────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}
