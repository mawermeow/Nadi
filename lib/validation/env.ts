import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NADI_APP_MODE: z.enum(['local', 'preview', 'production']).default('local'),
  NADI_DEBUG: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NADI_ENABLE_OFFLINE_SYNC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NADI_REPORT_MAX_RANGE_DAYS: z.coerce.number().int().positive().default(365),
  NADI_CORRELATION_DEFAULT_WINDOW_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24),
  NADI_CORRELATION_MIN_SAMPLE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}
