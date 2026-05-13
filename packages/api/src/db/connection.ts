import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { Database } from './schema.js';

const { Pool } = pg;

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL,
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }),
});

export const db = new Kysely<Database>({
  dialect,
  log(event) {
    if (event.level === 'query') {
      logger.debug('Query executed', {
        sql: event.query.sql,
        duration: `${String(event.queryDurationMillis)}ms`,
      });
    } else {
      logger.error('Database error', {
        error: event.error,
      });
    }
  },
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await db.selectFrom('users').select('id').limit(1).execute();
    logger.info('Database connection successful');
    return true;
  } catch {
    // Table might not exist yet, try a simpler query
    try {
      await sql`SELECT 1`.execute(db);
      logger.info('Database connection successful (tables not yet created)');
      return true;
    } catch (innerError) {
      logger.error('Database connection failed:', innerError);
      return false;
    }
  }
}
