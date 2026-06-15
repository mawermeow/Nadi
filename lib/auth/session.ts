import { getServerEnv } from '@/lib/validation/env';

export type SessionUser = {
  id: string;
  email: string;
};

const LOCAL_SESSION_USER: SessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const env = getServerEnv();

  if (env.NADI_APP_MODE === 'local') {
    return LOCAL_SESSION_USER;
  }

  return null;
}
