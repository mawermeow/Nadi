import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

import { getServerEnv } from '@/lib/validation/env';

async function main() {
  const env = getServerEnv();
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: './db/migrations',
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
