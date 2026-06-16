import { toItemResponse } from '@/features/items/api';
import { listItemsForUser } from '@/features/items/service';
import { RecordDashboard } from '@/features/records/components/record-dashboard';
import { listRecordsForUser } from '@/features/records/service';
import { getSummaryReportForUser } from '@/features/reports/service';
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
  const summaryReport = await getSummaryReportForUser(user, {
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
  });

  return (
    <RecordDashboard
      initialItems={items.map(toItemResponse)}
      initialRecords={records}
      initialSummaryReport={summaryReport}
      maxReportRangeDays={env.NADI_REPORT_MAX_RANGE_DAYS}
      userEmail={user.email}
    />
  );
}
