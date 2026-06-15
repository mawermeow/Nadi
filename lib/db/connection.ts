import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@/db/schema';

function isNeonDatabaseUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return url.hostname.includes('neon.tech');
  } catch {
    return false;
  }
}

export function createDb(connectionString: string) {
  if (isNeonDatabaseUrl(connectionString)) {
    const sql = neon(connectionString);

    return drizzleNeon(sql, {
      schema,
    });
  }

  const pool = new Pool({
    connectionString,
  });

  return drizzleNodePg(pool, {
    schema,
  });
}

export function createMigrationDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
  });

  return {
    db: drizzleNodePg(pool),
    pool,
  };
}
