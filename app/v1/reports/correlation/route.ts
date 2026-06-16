import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationReportForUser } from '@/features/reports/service';
import { createCorrelationReportQuerySchema } from '@/features/reports/schema';
import { requireUser } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/validation/env';
import { toApiError } from '@/lib/validation/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const env = getServerEnv();
    const query = createCorrelationReportQuerySchema(
      env.NADI_REPORT_MAX_RANGE_DAYS,
    ).parse({
      symptomItemId: request.nextUrl.searchParams.get('symptomItemId') ?? undefined,
      from: request.nextUrl.searchParams.get('from') ?? undefined,
      to: request.nextUrl.searchParams.get('to') ?? undefined,
      windowHours: request.nextUrl.searchParams.get('windowHours') ?? undefined,
    });
    const report = await getCorrelationReportForUser(user, query);

    return NextResponse.json(report);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
