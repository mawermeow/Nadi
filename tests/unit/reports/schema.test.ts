import { describe, expect, it } from 'vitest';

import { createSummaryReportQuerySchema } from '@/features/reports/schema';

describe('createSummaryReportQuerySchema', () => {
  it('accepts a valid date range', () => {
    const schema = createSummaryReportQuerySchema(30);
    const result = schema.parse({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-15T23:59:59.999Z',
    });

    expect(result.from).toBe('2026-06-01T00:00:00.000Z');
  });

  it('rejects ranges that exceed the configured max days', () => {
    const schema = createSummaryReportQuerySchema(7);
    const result = schema.safeParse({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-15T23:59:59.999Z',
    });

    expect(result.success).toBe(false);
  });
});
