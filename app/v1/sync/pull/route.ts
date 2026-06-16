import { NextRequest, NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';
import { syncPullRequestSchema } from '@/features/sync/schema';
import { pullSyncChangesForUser } from '@/features/sync/service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = syncPullRequestSchema.parse(await request.json());
    const response = await pullSyncChangesForUser(user, payload);

    return NextResponse.json(response);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
