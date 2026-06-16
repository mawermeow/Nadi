import { describe, expect, it } from 'vitest';

import {
  createCorrelationReportQuerySchema,
  createSummaryReportQuerySchema,
} from '@/features/reports/schema';

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

describe('createCorrelationReportQuerySchema', () => {
  it('accepts a valid correlation query', () => {
    const schema = createCorrelationReportQuerySchema(30);
    const result = schema.parse({
      symptomItemId: '11111111-1111-4111-8111-111111111111',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-15T23:59:59.999Z',
      windowHours: '48',
    });

    expect(result.windowHours).toBe(48);
  });

  it('rejects invalid window hours', () => {
    const schema = createCorrelationReportQuerySchema(30);
    const result = schema.safeParse({
      symptomItemId: '11111111-1111-4111-8111-111111111111',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-15T23:59:59.999Z',
      windowHours: '300',
    });

    expect(result.success).toBe(false);
  });
});
