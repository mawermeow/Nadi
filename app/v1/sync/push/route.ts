import { NextRequest, NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';
import { syncPushRequestSchema } from '@/features/sync/schema';
import { pushSyncOperationsForUser } from '@/features/sync/service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = syncPushRequestSchema.parse(await request.json());
    const response = await pushSyncOperationsForUser(user, payload);

    return NextResponse.json(response);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
