import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString, max: 5 });

  // An idle client can lose its connection (for example when PostgreSQL restarts).
  // Without this handler the error would crash the whole process.
  pool.on('error', (error) => {
    console.error(JSON.stringify({ level: 'error', message: 'Idle database client error', error: error.message }));
  });

  return pool;
}
