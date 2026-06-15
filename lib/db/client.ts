import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from '@/db/schema';
import { getServerEnv } from '@/lib/validation/env';

const env = getServerEnv();
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, {
  schema,
});
