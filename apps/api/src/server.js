import { createApp } from './app.js';
import { createPool } from './db.js';
import { createDatabaseCheck, createProductsRepository } from './products-repository.js';

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();

const app = createApp({
  productsRepository: createProductsRepository(pool),
  checkDatabase: createDatabaseCheck(pool),
});

const server = app.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', message: `API listening on port ${port}` }));
});

// Kubernetes sends SIGTERM during rolling updates: finish in-flight requests, then close the pool.
function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: `Received ${signal}, shutting down` }));
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
