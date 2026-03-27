// restmentor/packages/api/src/server.ts
import { buildApp } from './app.js';
import { Server } from 'socket.io';
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  const app = await buildApp();

  // ── Attach Socket.IO to Fastify's underlying HTTP server ──
  const io = new Server(app.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Make io available to all route handlers via app.io
  app.decorate('io', io);

  // ── Room-based connections (1 room per restaurant) ──
  io.on('connection', (socket) => {
    const restaurantId = socket.handshake.query.restaurantId as string;

    if (!restaurantId) {
      app.log.warn(`Socket ${socket.id} connected without restaurantId — disconnecting`);
      socket.disconnect();
      return;
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
