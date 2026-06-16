import { toItemResponse } from '@/features/items/api';
import { listItemsForUser } from '@/features/items/service';
import { RecordDashboard } from '@/features/records/components/record-dashboard';
import { createEmptyCorrelationReport } from '@/features/reports/correlation';
import { listRecordsForUser } from '@/features/records/service';
import {
  getCorrelationReportForUser,
  getSummaryReportForUser,
} from '@/features/reports/service';
import { requireUser } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireUser();
  const env = getServerEnv();
  const items = await listItemsForUser(user, {
    includeArchived: true,
  });
  const records = await listRecordsForUser(user);
  const defaultTo = new Date();
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultTo.getDate() - 13);
  const defaultFromIso = new Date(
    Date.UTC(
      defaultFrom.getUTCFullYear(),
      defaultFrom.getUTCMonth(),
      defaultFrom.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  ).toISOString();
  const defaultToIso = new Date(
    Date.UTC(
      defaultTo.getUTCFullYear(),
      defaultTo.getUTCMonth(),
      defaultTo.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  ).toISOString();
  const summaryReport = await getSummaryReportForUser(user, {
    from: defaultFromIso,
    to: defaultToIso,
  });
  const defaultSymptomItem = items.find((item) => item.type === 'symptom');
  const correlationReport = defaultSymptomItem
    ? await getCorrelationReportForUser(user, {
        symptomItemId: defaultSymptomItem.id,
        from: defaultFromIso,
        to: defaultToIso,
        windowHours: env.NADI_CORRELATION_DEFAULT_WINDOW_HOURS,
      })
    : createEmptyCorrelationReport({
        symptomItemId: '',
        from: defaultFromIso,
        to: defaultToIso,
        windowHours: env.NADI_CORRELATION_DEFAULT_WINDOW_HOURS,
        minimumSampleSize: env.NADI_CORRELATION_MIN_SAMPLE_SIZE,
      });

  return (
    <RecordDashboard
      initialItems={items.map(toItemResponse)}
      initialRecords={records}
      initialSummaryReport={summaryReport}
      initialCorrelationReport={correlationReport}
      maxReportRangeDays={env.NADI_REPORT_MAX_RANGE_DAYS}
      defaultCorrelationWindowHours={env.NADI_CORRELATION_DEFAULT_WINDOW_HOURS}
      userEmail={user.email}
    />
  );
}
