import type { SessionUser } from '@/lib/auth/session';

import { upsertUser } from './repository';

export async function ensureSessionUserRecord(user: SessionUser) {
  await upsertUser({
    id: user.id,
    email: user.email,
  });
}
