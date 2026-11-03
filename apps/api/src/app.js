import express from 'express';
import { createMetrics } from './metrics.js';
import { requestLogger } from './request-logger.js';
import { createProductsRouter } from './routes/products.js';

function errorHandler(error, request, response, next) {
  // express.json() marks malformed bodies with status 400.
  if (error.status === 400) {
    response.status(400).json({ errors: ['request body must be valid JSON'] });
    return;
  }
  console.error(JSON.stringify({ level: 'error', message: 'Unhandled request error', error: error.message }));
  response.status(500).json({ error: 'Internal server error' });
}

export function createApp({ productsRepository, checkDatabase, metrics = createMetrics() }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(metrics.middleware);
  app.use(express.json());

  app.get('/health/live', (request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/health', async (request, response) => {
    try {
      await checkDatabase();
      response.json({ status: 'ok', database: 'ok' });
    } catch {
      response.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.get('/metrics', async (request, response) => {
    response.set('Content-Type', metrics.registry.contentType);
    response.send(await metrics.registry.metrics());
  });

  app.use('/api/products', createProductsRouter(productsRepository));

  app.use((request, response) => {
    response.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return app;
}
