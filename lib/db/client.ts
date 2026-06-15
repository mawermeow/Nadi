import { ensureLocalEnvLoaded } from '@/lib/env/load-env';
import { createDb } from '@/lib/db/connection';
import { getServerEnv } from '@/lib/validation/env';

let cachedDb: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  ensureLocalEnvLoaded();
  const env = getServerEnv();
  cachedDb = createDb(env.DATABASE_URL);

  return cachedDb;
}
