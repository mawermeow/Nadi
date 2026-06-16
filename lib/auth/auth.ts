import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';

import { getDb } from '@/lib/db/client';
import { getServerEnv } from '@/lib/validation/env';

function getRequiredAuthEnv() {
  const env = getServerEnv();

  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET 必須設定且至少 32 字元');
  }

  if (!env.AUTH_URL) {
    throw new Error('AUTH_URL 必須設定');
  }

  return env;
}

const env = getRequiredAuthEnv();

export const auth = betterAuth({
  appName: 'Nadi',
  baseURL: env.AUTH_URL,
  secret: env.AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
  }),
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    modelName: 'accounts',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  plugins: [nextCookies()],
});
