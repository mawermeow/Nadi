import { NextResponse } from 'next/server';

import { getOwnershipCloudSummary } from '@/features/ownership/service';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function GET() {
  try {
    const user = await requireUser();
    const summary = await getOwnershipCloudSummary(user);
    return NextResponse.json(summary);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
