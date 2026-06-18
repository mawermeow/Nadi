import { NextResponse } from 'next/server';

import { applyBackupRecovery } from '@/features/ownership/service';
import { backupRecoveryRequestSchema, ownershipBackupSchema } from '@/features/ownership/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = backupRecoveryRequestSchema.parse(await request.json());
    const backup = ownershipBackupSchema.parse(body.payload);
    const result = await applyBackupRecovery(user, backup);
    return NextResponse.json(result);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
