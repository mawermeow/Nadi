import { findItemByIdForUser } from '@/features/items/repository';
import { ensureSessionUserRecord } from '@/features/auth/service';
import type { SessionUser } from '@/lib/auth/session';
import { normalizeRange } from '@/lib/date/range';
import { getServerEnv } from '@/lib/validation/env';
import { AppError } from '@/lib/validation/errors';

import { buildCorrelationReport, createEmptyCorrelationReport } from './correlation';
import { listReportRecordsByUserId } from './repository';
import type {
  CorrelationReportQueryInput,
  SummaryReportQueryInput,
} from './schema';
import {
  createCorrelationReportQuerySchema,
  createSummaryReportQuerySchema,
} from './schema';
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

export async function getCorrelationReportForUser(
  user: SessionUser,
  input: CorrelationReportQueryInput,
) {
  await ensureSessionUserRecord(user);

  const env = getServerEnv();
  const query = createCorrelationReportQuerySchema(
    env.NADI_REPORT_MAX_RANGE_DAYS,
  ).parse(input);
  const symptomItem = await findItemByIdForUser(query.symptomItemId, user.id);

  if (!symptomItem) {
    throw new AppError('找不到這個症狀項目', 404, 'ITEM_NOT_FOUND');
  }

  if (symptomItem.type !== 'symptom') {
    throw new AppError(
      'Correlation 報表只能選擇症狀項目',
      400,
      'CORRELATION_TARGET_INVALID',
    );
  }

  const range = normalizeRange(new Date(query.from), new Date(query.to));
  const rows = await listReportRecordsByUserId(user.id, range);

  if (rows.length === 0) {
    return createEmptyCorrelationReport(
      {
        symptomItemId: query.symptomItemId,
        from: query.from,
        to: query.to,
        windowHours: query.windowHours,
        minimumSampleSize: env.NADI_CORRELATION_MIN_SAMPLE_SIZE,
      },
      symptomItem.title,
    );
  }

  const report = buildCorrelationReport(rows, {
    symptomItemId: query.symptomItemId,
    from: query.from,
    to: query.to,
    windowHours: query.windowHours,
    minimumSampleSize: env.NADI_CORRELATION_MIN_SAMPLE_SIZE,
  });

  if (report.symptomTitle) {
    return report;
  }

  return {
    ...report,
    symptomTitle: symptomItem.title,
  };
}
