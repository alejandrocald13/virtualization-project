import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const LABEL_NAMES = ['method', 'route', 'status_code'];

// Use the route pattern (/api/products/:id), not the real path, so every product id
// does not create a new time series in Prometheus.
function routeLabel(request) {
  if (!request.route) {
    return 'unmatched';
  }
  const routePath = request.route.path === '/' ? '' : request.route.path;
  return `${request.baseUrl}${routePath}` || '/';
}

export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const requestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by the API',
    labelNames: LABEL_NAMES,
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: LABEL_NAMES,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  function middleware(request, response, next) {
    const stopTimer = requestDuration.startTimer();
    response.on('finish', () => {
      const labels = {
        method: request.method,
        route: routeLabel(request),
        status_code: String(response.statusCode),
      };
      requestsTotal.inc(labels);
      stopTimer(labels);
    });
    next();
  }

  return { registry, middleware };
}
