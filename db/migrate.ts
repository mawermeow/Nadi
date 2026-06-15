import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createMigrationDb } from '@/lib/db/connection';
import { ensureLocalEnvLoaded } from '@/lib/env/load-env';
import { getServerEnv } from '@/lib/validation/env';

async function main() {
  ensureLocalEnvLoaded();
  const env = getServerEnv();
  const connectionString = env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;
  const { db, pool } = createMigrationDb(connectionString);

  await migrate(db, {
    migrationsFolder: './db/migrations',
  });

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
