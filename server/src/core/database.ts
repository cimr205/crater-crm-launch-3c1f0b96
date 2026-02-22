import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from '../config/env';

if (!env.databaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL is not set. Database-backed routes will fail until configured.');
}

const useSsl = env.databaseUrl && !env.databaseUrl.includes('localhost') && !env.databaseUrl.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
