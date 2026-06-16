import { describe, expect, it } from 'vitest';

import { buildSummaryReport } from '@/features/reports/summary';

describe('buildSummaryReport', () => {
  it('aggregates metric and symptom summaries', () => {
    const report = buildSummaryReport(
      [
        {
          recordId: 'r1',
          itemId: 'metric-1',
          itemTitle: '睡眠',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 6,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-10T10:00:00.000Z'),
        },
        {
          recordId: 'r2',
          itemId: 'metric-1',
          itemTitle: '睡眠',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 8,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-11T10:00:00.000Z'),
        },
        {
          recordId: 'r3',
          itemId: 'symptom-1',
          itemTitle: '頭痛程度',
          itemType: 'symptom',
          valueType: 'scale',
          unit: null,
          valueNumber: 4,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-12T10:00:00.000Z'),
        },
        {
          recordId: 'r4',
          itemId: 'symptom-1',
          itemTitle: '頭痛程度',
          itemType: 'symptom',
          valueType: 'scale',
          unit: null,
          valueNumber: 6,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-13T10:00:00.000Z'),
        },
      ],
      {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-15T23:59:59.999Z',
      },
    );

    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0]).toMatchObject({
      title: '睡眠',
      count: 2,
      total: 14,
      avg: 7,
      min: 6,
      max: 8,
    });
    expect(report.symptoms).toHaveLength(1);
    expect(report.symptoms[0]).toMatchObject({
      title: '頭痛程度',
      occurrenceCount: 2,
      avgSeverity: 5,
    });
  });

  it('keeps non-numeric symptom severity undefined', () => {
    const report = buildSummaryReport(
      [
        {
          recordId: 'r1',
          itemId: 'symptom-2',
          itemTitle: '頭痛',
          itemType: 'symptom',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-12T10:00:00.000Z'),
        },
      ],
      {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-15T23:59:59.999Z',
      },
    );

    expect(report.symptoms[0].avgSeverity).toBeUndefined();
  });
});
