import { describe, expect, it } from 'vitest';

import { createRecordSchema, listRecordsQuerySchema } from '@/features/records/schema';

describe('createRecordSchema', () => {
  it('accepts a valid record payload', () => {
    const result = createRecordSchema.parse({
      itemId: '11111111-1111-4111-8111-111111111111',
      value: 6.5,
      recordedAt: '2026-06-15T10:30:00.000Z',
      note: '午睡後補記',
    });

    expect(result.value).toBe(6.5);
  });

  it('rejects invalid recordedAt', () => {
    const result = createRecordSchema.safeParse({
      itemId: '11111111-1111-4111-8111-111111111111',
      value: true,
      recordedAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });
});

describe('listRecordsQuerySchema', () => {
  it('accepts both as itemType', () => {
    const result = listRecordsQuerySchema.safeParse({
      itemType: 'both',
    });

    expect(result.success).toBe(true);
  });

  it('requires from and to together', () => {
    const result = listRecordsQuerySchema.safeParse({
      from: '2026-06-15T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid date ranges', () => {
    const result = listRecordsQuerySchema.safeParse({
      from: '2026-06-16T00:00:00.000Z',
      to: '2026-06-15T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });
});
