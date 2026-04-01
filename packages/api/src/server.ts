// restmentor/packages/api/src/server.ts
import { buildApp } from './app.js';
import { Server } from 'socket.io';
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  const app = await buildApp();

  // ── Restrict Socket.IO CORS to known origins ──────────
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];

  const io = new Server(app.server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  app.decorate('io', io);

  // ── Room-based connections with JWT validation ────────
  io.on('connection', (socket) => {
    const restaurantId = socket.handshake.query.restaurantId as string;
    const token = socket.handshake.auth?.token as string | undefined;

    if (!restaurantId) {
      app.log.warn(`Socket ${socket.id} connected without restaurantId — disconnecting`);
      socket.disconnect();
      return;
    }

    // Validate token if provided — displays may not have tokens
    // but the restaurantId must match the token if one is provided
    if (token) {
      try {
        const decoded = app.jwt.verify(token) as { restaurantId: string };
        if (decoded.restaurantId !== restaurantId) {
          app.log.warn(`Socket ${socket.id} token restaurantId mismatch — disconnecting`);
          socket.disconnect();
          return;
        }
      } catch {
        app.log.warn(`Socket ${socket.id} invalid token — disconnecting`);
        socket.disconnect();
        return;
      }
    }

    const room = `restaurant:${restaurantId}`;
    socket.join(room);
    app.log.info(`Socket ${socket.id} joined room ${room}`);

    socket.on('disconnect', () => {
      app.log.info(`Socket ${socket.id} left room ${room}`);
    });
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`RestMentor API running on http://localhost:${PORT}`);
    app.log.info(`WebSocket server ready on ws://localhost:${PORT}`);
    app.log.info(`Health check: http://localhost:${PORT}/api/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
