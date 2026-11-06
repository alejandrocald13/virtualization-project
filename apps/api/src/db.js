import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    // pg waits forever by default. If the node running PostgreSQL dies, requests would hang
    // and fill the pool; these fail fast so the API recovers as soon as the database returns.
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    keepAlive: true,
  });

  // An idle client can lose its connection (for example when PostgreSQL restarts).
  // Without this handler the error would crash the whole process.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ level: 'error', message: 'Idle database client error', error: error.message }));
  });

  return pool;
}
