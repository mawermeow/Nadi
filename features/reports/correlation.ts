import type {
  CorrelationCandidateResponse,
  CorrelationReportResponse,
} from './api';
import type { ReportRecordRow } from './repository';

type CorrelationOptions = {
  symptomItemId: string;
  from: string;
  to: string;
  windowHours: number;
  minimumSampleSize: number;
};

type TimeWindow = {
  from: Date;
  to: Date;
};

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mergeWindows(windows: TimeWindow[]) {
  if (windows.length === 0) {
    return [];
  }

  const sorted = [...windows].sort(
    (left, right) => left.from.getTime() - right.from.getTime(),
  );
  const merged: TimeWindow[] = [sorted[0]];

  for (const current of sorted.slice(1)) {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push(current);
      continue;
    }

    if (current.from.getTime() <= previous.to.getTime()) {
      previous.to =
        current.to.getTime() > previous.to.getTime() ? current.to : previous.to;
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function isInsideWindows(recordedAt: Date, windows: TimeWindow[]) {
  return windows.some(
    (window) =>
      recordedAt.getTime() >= window.from.getTime() &&
      recordedAt.getTime() < window.to.getTime(),
  );
}

function getOccurrenceRecords(rows: ReportRecordRow[], symptomItemId: string) {
  return rows.filter((row) => {
    if (row.itemId !== symptomItemId || row.itemType !== 'symptom') {
      return false;
    }

    if (row.valueType === 'boolean') {
      return row.valueBoolean === true;
    }

    if (row.valueType === 'text') {
      return (row.valueText ?? '').trim().length > 0;
    }

    return (row.valueNumber ?? 0) > 0;
  });
}

function buildCandidateDescription(
  mode: 'higher' | 'lower' | 'more-often' | 'less-often',
  windowHours: number,
  insufficientSample: boolean,
) {
  const observationByMode = {
    higher: `在目前資料中，可以觀察到症狀前 ${windowHours} 小時內，這個項目的數值可能偏高`,
    lower: `在目前資料中，可以觀察到症狀前 ${windowHours} 小時內，這個項目的數值可能偏低`,
    'more-often': `在目前資料中，可以觀察到症狀前 ${windowHours} 小時內，這個項目的紀錄可能較常出現`,
    'less-often': `在目前資料中，可以觀察到症狀前 ${windowHours} 小時內，這個項目的紀錄可能較少出現`,
  } as const;

  if (insufficientSample) {
    return `${observationByMode[mode]}；樣本數仍不足，需要更多紀錄確認。`;
  }

  return `${observationByMode[mode]}；這只代表可能相關，並不代表因果關係。`;
}

export function createEmptyCorrelationReport(
  options: CorrelationOptions,
  symptomTitle = '',
): CorrelationReportResponse {
  return {
    symptomItemId: options.symptomItemId,
    symptomTitle,
    from: options.from,
    to: options.to,
    windowHours: options.windowHours,
    symptomSampleSize: 0,
    minimumSampleSize: options.minimumSampleSize,
    candidates: [],
  };
}

function buildTimeWindows(
  symptomRows: ReportRecordRow[],
  range: {
    from: Date;
    to: Date;
  },
  windowHours: number,
) {
  const windowMs = windowHours * 60 * 60 * 1000;

  return mergeWindows(
    symptomRows.map((row) => ({
      from: new Date(Math.max(range.from.getTime(), row.recordedAt.getTime() - windowMs)),
      to: row.recordedAt,
    })),
  );
}

function buildNumericCandidate(
  itemRows: ReportRecordRow[],
  insideRows: ReportRecordRow[],
  windowHours: number,
  insufficientSample: boolean,
): CorrelationCandidateResponse | null {
  const numericInside = insideRows
    .map((row) => row.valueNumber)
    .filter((value): value is number => value !== null);
  const numericOutside = itemRows
    .filter((row) => !insideRows.includes(row))
    .map((row) => row.valueNumber)
    .filter((value): value is number => value !== null);

  if (numericInside.length === 0 || numericOutside.length === 0) {
    return null;
  }

  const insideAvg =
    numericInside.reduce((sum, value) => sum + value, 0) / numericInside.length;
  const outsideAvg =
    numericOutside.reduce((sum, value) => sum + value, 0) / numericOutside.length;
  const rawScore = (insideAvg - outsideAvg) / Math.max(Math.abs(outsideAvg), 1);
  const correlationScore = roundToTwo(clamp(rawScore, -1, 1));
  const [firstRow] = itemRows;

  if (!firstRow) {
    return null;
  }

  return {
    itemId: firstRow.itemId,
    title: firstRow.itemTitle,
    unit: firstRow.unit ?? undefined,
    valueType: firstRow.valueType,
    correlationScore,
    sampleSize: numericInside.length,
    description: buildCandidateDescription(
      correlationScore >= 0 ? 'higher' : 'lower',
      windowHours,
      insufficientSample,
    ),
  };
}

function buildBooleanCandidate(
  itemRows: ReportRecordRow[],
  insideRows: ReportRecordRow[],
  windowHours: number,
  insufficientSample: boolean,
): CorrelationCandidateResponse | null {
  const insideValues = insideRows
    .map((row) => row.valueBoolean)
    .filter((value): value is boolean => value !== null);
  const outsideValues = itemRows
    .filter((row) => !insideRows.includes(row))
    .map((row) => row.valueBoolean)
    .filter((value): value is boolean => value !== null);

  if (insideValues.length === 0 || outsideValues.length === 0) {
    return null;
  }

  const insideRate =
    insideValues.filter(Boolean).length / insideValues.length;
  const outsideRate =
    outsideValues.filter(Boolean).length / outsideValues.length;
  const correlationScore = roundToTwo(clamp(insideRate - outsideRate, -1, 1));
  const [firstRow] = itemRows;

  if (!firstRow) {
    return null;
  }

  return {
    itemId: firstRow.itemId,
    title: firstRow.itemTitle,
    unit: firstRow.unit ?? undefined,
    valueType: firstRow.valueType,
    correlationScore,
    sampleSize: insideValues.length,
    description: buildCandidateDescription(
      correlationScore >= 0 ? 'more-often' : 'less-often',
      windowHours,
      insufficientSample,
    ),
  };
}

function getWindowCoverageHours(
  windows: TimeWindow[],
  range: {
    from: Date;
    to: Date;
  },
) {
  const mergedWindows = mergeWindows(windows);
  const coverageMs = mergedWindows.reduce((total, window) => {
    return total + Math.max(0, window.to.getTime() - window.from.getTime());
  }, 0);
  const totalMs = Math.max(0, range.to.getTime() - range.from.getTime());

  return {
    insideHours: coverageMs / (60 * 60 * 1000),
    outsideHours: Math.max(0, totalMs - coverageMs) / (60 * 60 * 1000),
  };
}

function buildTextCandidate(
  itemRows: ReportRecordRow[],
  insideRows: ReportRecordRow[],
  range: {
    from: Date;
    to: Date;
  },
  windows: TimeWindow[],
  windowHours: number,
  insufficientSample: boolean,
): CorrelationCandidateResponse | null {
  const { insideHours, outsideHours } = getWindowCoverageHours(windows, range);

  if (insideRows.length === 0 || outsideHours <= 0 || insideHours <= 0) {
    return null;
  }

  const outsideCount = itemRows.length - insideRows.length;

  if (outsideCount <= 0) {
    return null;
  }

  const insideRate = insideRows.length / insideHours;
  const outsideRate = outsideCount / outsideHours;
  const rawScore = (insideRate - outsideRate) / Math.max(outsideRate, 1);
  const correlationScore = roundToTwo(clamp(rawScore, -1, 1));
  const [firstRow] = itemRows;

  if (!firstRow) {
    return null;
  }

  return {
    itemId: firstRow.itemId,
    title: firstRow.itemTitle,
    unit: firstRow.unit ?? undefined,
    valueType: firstRow.valueType,
    correlationScore,
    sampleSize: insideRows.length,
    description: buildCandidateDescription(
      correlationScore >= 0 ? 'more-often' : 'less-often',
      windowHours,
      insufficientSample,
    ),
  };
}

export function buildCorrelationReport(
  rows: ReportRecordRow[],
  options: CorrelationOptions,
): CorrelationReportResponse {
  const symptomRows = getOccurrenceRecords(rows, options.symptomItemId);
  const [firstSymptomRow] = rows.filter((row) => row.itemId === options.symptomItemId);

  if (!firstSymptomRow) {
    return createEmptyCorrelationReport(options);
  }

  if (firstSymptomRow.itemType !== 'symptom') {
    return createEmptyCorrelationReport(options, firstSymptomRow.itemTitle);
  }

  if (symptomRows.length === 0) {
    return createEmptyCorrelationReport(options, firstSymptomRow.itemTitle);
  }

  const range = {
    from: new Date(options.from),
    to: new Date(options.to),
  };
  const windows = buildTimeWindows(symptomRows, range, options.windowHours);
  const groupedMetricRows = new Map<string, ReportRecordRow[]>();

  for (const row of rows) {
    if (row.itemType !== 'metric') {
      continue;
    }

    const existing = groupedMetricRows.get(row.itemId) ?? [];
    existing.push(row);
    groupedMetricRows.set(row.itemId, existing);
  }

  const candidates: CorrelationCandidateResponse[] = [];

  for (const itemRows of groupedMetricRows.values()) {
    const insideRows = itemRows.filter((row) =>
      isInsideWindows(row.recordedAt, windows),
    );
    const insufficientSample =
      symptomRows.length < options.minimumSampleSize ||
      insideRows.length < options.minimumSampleSize;

    const [firstRow] = itemRows;

    if (!firstRow) {
      continue;
    }

    let candidate: CorrelationCandidateResponse | null = null;

    if (firstRow.valueType === 'number' || firstRow.valueType === 'scale') {
      candidate = buildNumericCandidate(
        itemRows,
        insideRows,
        options.windowHours,
        insufficientSample,
      );
    } else if (firstRow.valueType === 'boolean') {
      candidate = buildBooleanCandidate(
        itemRows,
        insideRows,
        options.windowHours,
        insufficientSample,
      );
    } else {
      candidate = buildTextCandidate(
        itemRows,
        insideRows,
        range,
        windows,
        options.windowHours,
        insufficientSample,
      );
    }

    if (!candidate) {
      continue;
    }

    if (Math.abs(candidate.correlationScore) < 0.01) {
      continue;
    }

    candidates.push(candidate);
  }

  candidates.sort((left, right) => {
    return (
      Math.abs(right.correlationScore) - Math.abs(left.correlationScore) ||
      right.sampleSize - left.sampleSize ||
      left.title.localeCompare(right.title)
    );
  });

  return {
    symptomItemId: firstSymptomRow.itemId,
    symptomTitle: firstSymptomRow.itemTitle,
    from: options.from,
    to: options.to,
    windowHours: options.windowHours,
    symptomSampleSize: symptomRows.length,
    minimumSampleSize: options.minimumSampleSize,
    candidates,
  };
}

export function getDefaultCorrelationDescription(report: CorrelationReportResponse) {
  if (report.symptomSampleSize === 0) {
    return '目前選定區間內還沒有足夠的症狀事件可供比對。';
  }

  if (report.symptomSampleSize < report.minimumSampleSize) {
    return `目前只有 ${report.symptomSampleSize} 筆症狀事件，樣本數仍不足，結果只適合作為初步觀察。`;
  }

  if (report.candidates.length === 0) {
    return '目前資料中還沒有明顯可整理的關聯訊號。你可以持續記錄，之後再回來查看。';
  }

  return `以下內容只描述可能相關的模式，不代表因果關係或醫療結論。`;
}
