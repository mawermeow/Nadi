import { describe, expect, it } from 'vitest';

import { createItemSchema, updateItemSchema } from '@/features/items/schema';

describe('createItemSchema', () => {
  it('accepts a valid metric item', () => {
    const result = createItemSchema.parse({
      title: '睡眠',
      type: 'metric',
      valueType: 'number',
      unit: '小時',
    });

    expect(result.title).toBe('睡眠');
    expect(result.scaleMin).toBeUndefined();
  });

  it('requires scaleMin and scaleMax for scale items', () => {
    const result = createItemSchema.safeParse({
      title: '頭痛程度',
      type: 'symptom',
      valueType: 'scale',
      scaleMin: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects scale config on non-scale items', () => {
    const result = createItemSchema.safeParse({
      title: '喝水',
      type: 'metric',
      valueType: 'number',
      scaleMin: 1,
      scaleMax: 5,
    });

    expect(result.success).toBe(false);
  });
});

describe('updateItemSchema', () => {
  it('requires at least one field', () => {
    const result = updateItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('allows clearing unit with an empty string', () => {
    const result = updateItemSchema.parse({
      unit: '',
    });

    expect(result.unit).toBeNull();
  });
});
