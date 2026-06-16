import { ensureSessionUserRecord } from '@/features/auth/service';
import type { SessionUser } from '@/lib/auth/session';
import { normalizeRange } from '@/lib/date/range';
import { getServerEnv } from '@/lib/validation/env';

import type { SummaryReportQueryInput } from './schema';
import { createSummaryReportQuerySchema } from './schema';
import { listReportRecordsByUserId } from './repository';
import { buildSummaryReport } from './summary';

export async function getSummaryReportForUser(
  user: SessionUser,
  input: SummaryReportQueryInput,
) {
  await ensureSessionUserRecord(user);

  const env = getServerEnv();
  const query = createSummaryReportQuerySchema(env.NADI_REPORT_MAX_RANGE_DAYS).parse(
    input,
  );
  const range = normalizeRange(new Date(query.from), new Date(query.to));
  const rows = await listReportRecordsByUserId(user.id, range);

  return buildSummaryReport(rows, {
    from: query.from,
    to: query.to,
  });
}
