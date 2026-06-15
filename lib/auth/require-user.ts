import { AppError } from '@/lib/validation/errors';

import { getSessionUser } from './session';

export async function requireUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  return user;
}
