import { headers } from 'next/headers';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

import { auth } from './auth';

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
  };
}
