import { ensureLocalEnvLoaded } from '@/lib/env/load-env';
import { createDb } from '@/lib/db/connection';
import { getServerEnv } from '@/lib/validation/env';

ensureLocalEnvLoaded();
const env = getServerEnv();
export const db = createDb(env.DATABASE_URL);
