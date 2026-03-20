import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { tableRoutes } from './routes/tables.js';
import { sessionRoutes } from './routes/sessions.js';
import { orderRoutes } from './routes/orders.js';
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

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
    };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tableRoutes, { prefix: '/api/tables' });
  await app.register(sessionRoutes, { prefix: '/api/tables' });
  await app.register(orderRoutes, { prefix: '/api' });

  return app;
}
