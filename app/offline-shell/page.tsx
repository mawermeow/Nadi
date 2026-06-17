import { RecordDashboard } from '@/features/records/components/record-dashboard';
import { createEmptyCorrelationReport } from '@/features/reports/correlation';
import type {
  CorrelationReportResponse,
  SummaryReportResponse,
} from '@/features/reports/api';

function getDefaultDateRange() {
  const defaultTo = new Date();
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultTo.getDate() - 13);

  return {
    from: new Date(
      Date.UTC(
        defaultFrom.getUTCFullYear(),
        defaultFrom.getUTCMonth(),
        defaultFrom.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    ).toISOString(),
    to: new Date(
      Date.UTC(
        defaultTo.getUTCFullYear(),
        defaultTo.getUTCMonth(),
        defaultTo.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    ).toISOString(),
  };
}

export default function OfflineShellPage() {
  const dateRange = getDefaultDateRange();
  const maxReportRangeDays = Number(process.env.NADI_REPORT_MAX_RANGE_DAYS ?? 365);
  const defaultCorrelationWindowHours = Number(
    process.env.NADI_CORRELATION_DEFAULT_WINDOW_HOURS ?? 24,
  );
  const minimumSampleSize = Number(process.env.NADI_CORRELATION_MIN_SAMPLE_SIZE ?? 5);

  const initialSummaryReport: SummaryReportResponse = {
    from: dateRange.from,
    to: dateRange.to,
    metrics: [],
    symptoms: [],
  };
  const initialCorrelationReport: CorrelationReportResponse =
    createEmptyCorrelationReport(
      {
        symptomItemId: '',
        from: dateRange.from,
        to: dateRange.to,
        windowHours: defaultCorrelationWindowHours,
        minimumSampleSize,
      },
      '',
    );

  return (
    <RecordDashboard
      initialItems={[]}
      initialRecords={[]}
      initialSummaryReport={initialSummaryReport}
      initialCorrelationReport={initialCorrelationReport}
      maxReportRangeDays={maxReportRangeDays}
      defaultCorrelationWindowHours={defaultCorrelationWindowHours}
      sessionUser={null}
    />
  );
}
