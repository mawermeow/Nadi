import { describe, expect, it } from 'vitest';

import {
  buildCorrelationReport,
  getDefaultCorrelationDescription,
} from '@/features/reports/correlation';

describe('buildCorrelationReport', () => {
  it('compares metric values and boolean frequency inside symptom windows', () => {
    const report = buildCorrelationReport(
      [
        {
          recordId: 'metric-outside-1',
          itemId: 'metric-sleep',
          itemTitle: '睡眠時數',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 8,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-01T10:00:00.000Z'),
        },
        {
          recordId: 'metric-inside-1',
          itemId: 'metric-sleep',
          itemTitle: '睡眠時數',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 5,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-02T06:00:00.000Z'),
        },
        {
          recordId: 'metric-inside-2',
          itemId: 'metric-sleep',
          itemTitle: '睡眠時數',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 4,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-03T04:00:00.000Z'),
        },
        {
          recordId: 'habit-outside-1',
          itemId: 'metric-caffeine',
          itemTitle: '咖啡',
          itemType: 'metric',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: false,
          valueText: null,
          recordedAt: new Date('2026-06-01T09:00:00.000Z'),
        },
        {
          recordId: 'habit-inside-1',
          itemId: 'metric-caffeine',
          itemTitle: '咖啡',
          itemType: 'metric',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-02T08:00:00.000Z'),
        },
        {
          recordId: 'habit-inside-2',
          itemId: 'metric-caffeine',
          itemTitle: '咖啡',
          itemType: 'metric',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-03T08:00:00.000Z'),
        },
        {
          recordId: 'symptom-1',
          itemId: 'symptom-headache',
          itemTitle: '頭痛',
          itemType: 'symptom',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-02T12:00:00.000Z'),
        },
        {
          recordId: 'symptom-2',
          itemId: 'symptom-headache',
          itemTitle: '頭痛',
          itemType: 'symptom',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-03T12:00:00.000Z'),
        },
      ],
      {
        symptomItemId: 'symptom-headache',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-03T23:59:59.999Z',
        windowHours: 24,
        minimumSampleSize: 2,
      },
    );

    expect(report.symptomSampleSize).toBe(2);
    expect(report.candidates).toHaveLength(2);
    expect(report.candidates[0]).toMatchObject({
      itemId: 'metric-caffeine',
      correlationScore: 1,
      sampleSize: 2,
    });
    expect(report.candidates[1]).toMatchObject({
      itemId: 'metric-sleep',
      correlationScore: -0.44,
      sampleSize: 2,
    });
    expect(report.candidates[1]?.description).toContain('偏低');
  });

  it('marks candidate descriptions when symptom sample size is insufficient', () => {
    const report = buildCorrelationReport(
      [
        {
          recordId: 'metric-inside',
          itemId: 'metric-sleep',
          itemTitle: '睡眠時數',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 5,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-02T06:00:00.000Z'),
        },
        {
          recordId: 'metric-outside',
          itemId: 'metric-sleep',
          itemTitle: '睡眠時數',
          itemType: 'metric',
          valueType: 'number',
          unit: '小時',
          valueNumber: 8,
          valueBoolean: null,
          valueText: null,
          recordedAt: new Date('2026-06-01T06:00:00.000Z'),
        },
        {
          recordId: 'symptom-false',
          itemId: 'symptom-headache',
          itemTitle: '頭痛',
          itemType: 'symptom',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: false,
          valueText: null,
          recordedAt: new Date('2026-06-02T10:00:00.000Z'),
        },
        {
          recordId: 'symptom-true',
          itemId: 'symptom-headache',
          itemTitle: '頭痛',
          itemType: 'symptom',
          valueType: 'boolean',
          unit: null,
          valueNumber: null,
          valueBoolean: true,
          valueText: null,
          recordedAt: new Date('2026-06-02T12:00:00.000Z'),
        },
      ],
      {
        symptomItemId: 'symptom-headache',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-03T23:59:59.999Z',
        windowHours: 24,
        minimumSampleSize: 3,
      },
    );

    expect(report.symptomSampleSize).toBe(1);
    expect(report.candidates[0]?.description).toContain('樣本數仍不足');
    expect(getDefaultCorrelationDescription(report)).toContain('樣本數仍不足');
  });
});
