import { describe, expect, it } from 'vitest';

import { syncPullRequestSchema, syncPushRequestSchema } from '@/features/sync/schema';

describe('syncPushRequestSchema', () => {
  it('accepts a valid update operation with baseVersion', () => {
    const result = syncPushRequestSchema.parse({
      deviceId: 'device-local',
      operations: [
        {
          operationId: 'op-1',
          entityType: 'item',
          operationType: 'update',
          entityId: '11111111-1111-4111-8111-111111111111',
          baseVersion: 1,
          payload: {
            title: '睡眠',
          },
          clientCreatedAt: '2026-06-16T00:00:00.000Z',
          clientUpdatedAt: '2026-06-16T01:00:00.000Z',
        },
      ],
    });

    expect(result.operations).toHaveLength(1);
  });

  it('rejects update without baseVersion', () => {
    expect(() =>
      syncPushRequestSchema.parse({
        deviceId: 'device-local',
        operations: [
          {
            operationId: 'op-1',
            entityType: 'item',
            operationType: 'update',
            entityId: '11111111-1111-4111-8111-111111111111',
            payload: {
              title: '睡眠',
            },
            clientCreatedAt: '2026-06-16T00:00:00.000Z',
            clientUpdatedAt: '2026-06-16T01:00:00.000Z',
          },
        ],
      }),
    ).toThrow('update / delete 需要提供 baseVersion');
  });

  it('accepts record payload with null note', () => {
    const result = syncPushRequestSchema.parse({
      deviceId: 'device-local',
      operations: [
        {
          operationId: 'op-2',
          entityType: 'record',
          operationType: 'create',
          entityId: '11111111-1111-4111-8111-111111111118',
          payload: {
            itemId: '11111111-1111-4111-8111-111111111111',
            value: 6.5,
            recordedAt: '2026-06-16T08:00:00.000Z',
            note: null,
          },
          clientCreatedAt: '2026-06-16T08:00:00.000Z',
          clientUpdatedAt: '2026-06-16T08:00:00.000Z',
        },
      ],
    });

    expect(result.operations).toHaveLength(1);
  });
});

describe('syncPullRequestSchema', () => {
  it('accepts initial pull without lastPulledAt', () => {
    const result = syncPullRequestSchema.parse({
      deviceId: 'device-local',
    });

    expect(result.deviceId).toBe('device-local');
  });
});
