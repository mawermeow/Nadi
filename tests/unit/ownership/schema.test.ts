import { describe, expect, it } from 'vitest';

import { ownershipBackupSchema } from '@/features/ownership/schema';

const validBackup = {
  schemaVersion: 1,
  exportedAt: '2026-06-18T10:00:00.000Z',
  exportFormat: 'full_backup',
  userReference: 'ma***@example.com',
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: '睡眠時數',
      type: 'metric',
      unit: 'hr',
      valueType: 'number',
      scaleMin: null,
      scaleMax: null,
      sortOrder: 0,
      archived: false,
      version: 1,
      deletedAt: null,
      createdAt: '2026-06-18T10:00:00.000Z',
      updatedAt: '2026-06-18T10:00:00.000Z',
      lastSyncedAt: null,
      deviceId: 'device-1',
    },
  ],
  records: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      itemId: '11111111-1111-4111-8111-111111111111',
      valueNumber: 7.5,
      valueText: null,
      valueBoolean: null,
      recordedAt: '2026-06-18T10:00:00.000Z',
      note: 'mock note',
      version: 1,
      deletedAt: null,
      createdAt: '2026-06-18T10:00:00.000Z',
      updatedAt: '2026-06-18T10:00:00.000Z',
      lastSyncedAt: null,
      deviceId: 'device-1',
    },
  ],
  reportSnapshots: [],
  devices: [],
};

describe('ownershipBackupSchema', () => {
  it('accepts a valid backup payload', () => {
    const result = ownershipBackupSchema.safeParse(validBackup);
    expect(result.success).toBe(true);
  });

  it('rejects records that reference missing items', () => {
    const result = ownershipBackupSchema.safeParse({
      ...validBackup,
      records: [
        {
          ...validBackup.records[0],
          itemId: '33333333-3333-4333-8333-333333333333',
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('找不到對應項目');
  });

  it('rejects records with multiple populated value slots', () => {
    const result = ownershipBackupSchema.safeParse({
      ...validBackup,
      records: [
        {
          ...validBackup.records[0],
          valueText: 'duplicate',
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('值欄位必須且只能有一個');
  });
});
