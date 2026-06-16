import { NextRequest, NextResponse } from 'next/server';

import { getSummaryReportForUser } from '@/features/reports/service';
import { createSummaryReportQuerySchema } from '@/features/reports/schema';
import { requireUser } from '@/lib/auth/require-user';
import { getServerEnv } from '@/lib/validation/env';
import { toApiError } from '@/lib/validation/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const env = getServerEnv();
    const query = createSummaryReportQuerySchema(
      env.NADI_REPORT_MAX_RANGE_DAYS,
    ).parse({
      from: request.nextUrl.searchParams.get('from') ?? undefined,
      to: request.nextUrl.searchParams.get('to') ?? undefined,
    });
    const report = await getSummaryReportForUser(user, query);

    return NextResponse.json(report);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
