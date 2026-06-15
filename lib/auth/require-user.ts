import { AppError } from '@/lib/validation/errors';

import { getSessionUser } from './session';

export async function requireUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new AppError('尚未登入', 401, 'UNAUTHORIZED');
  }

  return user;
}
