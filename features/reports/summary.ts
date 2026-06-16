import type {
  MetricSummaryResponse,
  SummaryReportResponse,
  SymptomSummaryResponse,
} from './api';

type SummaryRecordRow = {
  recordId: string;
  itemId: string;
  itemTitle: string;
  itemType: 'metric' | 'symptom';
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  unit: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueText: string | null;
  recordedAt: Date;
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function getNumericValues(records: SummaryRecordRow[]) {
  return records
    .map((record) => record.valueNumber)
    .filter((value): value is number => value !== null);
}

function getSummaryValue(record: SummaryRecordRow) {
  if (record.valueType === 'boolean') {
    return record.valueBoolean ? '是' : '否';
  }

  if (record.valueType === 'text') {
    return record.valueText ?? '';
  }

  return record.valueNumber ?? 0;
}

export function buildSummaryReport(
  rows: SummaryRecordRow[],
  range: {
    from: string;
    to: string;
  },
): SummaryReportResponse {
  const grouped = new Map<string, SummaryRecordRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.itemId) ?? [];
    existing.push(row);
    grouped.set(row.itemId, existing);
  }

  const metrics: MetricSummaryResponse[] = [];
  const symptoms: SymptomSummaryResponse[] = [];

  for (const records of grouped.values()) {
    const [firstRecord] = records;

    if (!firstRecord) {
      continue;
    }

    if (firstRecord.itemType === 'metric') {
      const numericValues = getNumericValues(records);

      metrics.push({
        itemId: firstRecord.itemId,
        title: firstRecord.itemTitle,
        unit: firstRecord.unit ?? undefined,
        valueType: firstRecord.valueType,
        count: records.length,
        total:
          numericValues.length > 0
            ? roundToTwo(numericValues.reduce((sum, value) => sum + value, 0))
            : undefined,
        avg:
          numericValues.length > 0
            ? roundToTwo(
                numericValues.reduce((sum, value) => sum + value, 0) /
                  numericValues.length,
              )
            : undefined,
        min:
          numericValues.length > 0 ? Math.min(...numericValues) : undefined,
        max:
          numericValues.length > 0 ? Math.max(...numericValues) : undefined,
      });

      continue;
    }

    const severityValues =
      firstRecord.valueType === 'number' || firstRecord.valueType === 'scale'
        ? getNumericValues(records)
        : [];

    symptoms.push({
      itemId: firstRecord.itemId,
      title: firstRecord.itemTitle,
      valueType: firstRecord.valueType,
      occurrenceCount: records.length,
      avgSeverity:
        severityValues.length > 0
          ? roundToTwo(
              severityValues.reduce((sum, value) => sum + value, 0) /
                severityValues.length,
            )
          : undefined,
    });
  }

  metrics.sort((left, right) => right.count - left.count || left.title.localeCompare(right.title));
  symptoms.sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      left.title.localeCompare(right.title),
  );

  return {
    from: range.from,
    to: range.to,
    metrics,
    symptoms,
  };
}

export function formatMetricPreviewValue(metric: MetricSummaryResponse) {
  if (metric.avg !== undefined) {
    return `${metric.avg}${metric.unit ? ` ${metric.unit}` : ''}`;
  }

  return `${metric.count} 筆`;
}

export function formatSymptomPreviewValue(symptom: SymptomSummaryResponse) {
  if (symptom.avgSeverity !== undefined) {
    return `平均 ${symptom.avgSeverity}`;
  }

  return `${symptom.occurrenceCount} 次`;
}

export function mapTimelinePreview(rows: SummaryRecordRow[]) {
  return rows.map((row) => ({
    itemId: row.itemId,
    value: getSummaryValue(row),
  }));
}
