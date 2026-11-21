import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool (Object Method)
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 20000,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Prevent unhandled pool-level errors from crashing or spamming stderr on idle Cloud SQL proxy drops
    global._postgresPool.on('error', (err: any) => {
      const msg = String(err?.message || '');
      const code = String(err?.code || '');
      const isExpectedIdleDrop =
        /Connection terminated unexpectedly|server closed the connection unexpectedly|ECONNRESET|EPIPE|ETIMEDOUT/i.test(msg) ||
        ['57P01', '57P02', '57P03', '08006', '08003', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(code);
      if (isExpectedIdleDrop) {
        // pg.Pool automatically evicts the dead idle client and opens a fresh one on the next query.
        return;
      }
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance lazily.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
