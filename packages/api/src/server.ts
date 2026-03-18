import { buildApp } from './app.js';
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`RestMentor API running on http://localhost:${PORT}`);
    app.log.info(`Health check: http://localhost:${PORT}/api/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
