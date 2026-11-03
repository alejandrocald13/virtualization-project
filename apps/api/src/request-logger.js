// Probes and Prometheus scrapes run every few seconds; logging them would bury real traffic in Loki.
const QUIET_PATHS = ['/health', '/health/live', '/metrics'];

export function requestLogger(request, response, next) {
  if (QUIET_PATHS.includes(request.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        level: 'info',
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      }),
    );
  });
  next();
}
