import { z } from 'zod';

import {
  syncEntityTypeSchema,
  syncOperationTypeSchema,
  syncPullRequestSchema,
  syncPushRequestSchema,
} from '@/features/sync/schema';
import { setServerTime } from '@/features/sync/meta';
import type { SyncPullRequest, SyncPullResponse, SyncPushRequest, SyncPushResponse } from '@/features/sync/types';

const isoDateTimeSchema = z.string().datetime({ offset: true });

const syncAcceptedOperationResponseSchema = z.object({
  operationId: z.string().min(1),
  entityType: syncEntityTypeSchema,
  operationType: syncOperationTypeSchema,
  entityId: z.uuid(),
  version: z.number().int().positive(),
  updatedAt: isoDateTimeSchema,
});

const syncRejectedOperationResponseSchema = z.object({
  operationId: z.string().min(1),
  entityType: syncEntityTypeSchema,
  operationType: syncOperationTypeSchema,
  entityId: z.uuid(),
  reason: z.string().min(1),
  message: z.string().min(1),
});

const syncItemEntitySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  type: z.enum(['metric', 'symptom']),
  unit: z.string().nullable(),
  valueType: z.enum(['number', 'boolean', 'scale', 'text']),
  scaleMin: z.number().int().nullable(),
  scaleMax: z.number().int().nullable(),
  archived: z.boolean(),
  version: z.number().int().positive(),
  deletedAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  lastSyncedAt: isoDateTimeSchema.nullable(),
  deviceId: z.string().nullable(),
});

const syncRecordEntitySchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  valueNumber: z.number().nullable(),
  valueText: z.string().nullable(),
  valueBoolean: z.boolean().nullable(),
  recordedAt: isoDateTimeSchema,
  note: z.string().nullable(),
  version: z.number().int().positive(),
  deletedAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  lastSyncedAt: isoDateTimeSchema.nullable(),
  deviceId: z.string().nullable(),
});

const syncConflictSchema = z.object({
  operationId: z.string().min(1),
  entityType: syncEntityTypeSchema,
  operationType: syncOperationTypeSchema,
  entityId: z.uuid(),
  baseVersion: z.number().int().nonnegative(),
  currentVersion: z.number().int().positive(),
  serverEntity: z.union([syncItemEntitySchema, syncRecordEntitySchema]),
});

const syncPushResponseSchema = z.object({
  accepted: z.array(syncAcceptedOperationResponseSchema),
  rejected: z.array(syncRejectedOperationResponseSchema),
  conflicts: z.array(syncConflictSchema),
  serverTime: isoDateTimeSchema,
});

const syncTombstoneSchema = z.object({
  entityType: syncEntityTypeSchema,
  entityId: z.uuid(),
  deletedAt: isoDateTimeSchema,
  version: z.number().int().positive(),
  updatedAt: isoDateTimeSchema,
});

const syncPullResponseSchema = z.object({
  items: z.array(syncItemEntitySchema),
  records: z.array(syncRecordEntitySchema),
  tombstones: z.array(syncTombstoneSchema),
  serverTime: isoDateTimeSchema,
});

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class SyncClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly isNetworkError = false,
  ) {
    super(message);
    this.name = 'SyncClientError';
  }
}

async function parseErrorResponse(response: Response) {
  let body: ApiErrorBody | null = null;

  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  const message = body?.error?.message ?? `同步請求失敗 (${response.status})`;
  const code = body?.error?.code ?? 'SYNC_HTTP_ERROR';
  return new SyncClientError(message, code, response.status);
}

async function postJson<TRequest, TResponse extends { serverTime: string }>(
  url: string,
  payload: TRequest,
  responseSchema: z.ZodType<TResponse>,
) {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new SyncClientError(
      error instanceof Error ? error.message : '網路連線失敗',
      'NETWORK_ERROR',
      undefined,
      true,
    );
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new SyncClientError('同步回應不是合法 JSON', 'INVALID_RESPONSE');
  }

  const parsed = responseSchema.safeParse(body);

  if (!parsed.success) {
    throw new SyncClientError('同步回應格式錯誤', 'INVALID_RESPONSE');
  }

  await setServerTime(parsed.data.serverTime);

  return parsed.data;
}

export async function pushSyncOperations(
  input: SyncPushRequest,
): Promise<SyncPushResponse> {
  const payload = syncPushRequestSchema.parse(input);
  return postJson('/v1/sync/push', payload, syncPushResponseSchema);
}

export async function pullSyncChanges(
  input: SyncPullRequest,
): Promise<SyncPullResponse> {
  const payload = syncPullRequestSchema.parse(input);
  return postJson('/v1/sync/pull', payload, syncPullResponseSchema);
}
