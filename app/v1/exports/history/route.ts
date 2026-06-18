import { NextResponse } from 'next/server';

import { listOwnershipExportHistory } from '@/features/ownership/service';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function GET() {
  try {
    const user = await requireUser();
    const history = await listOwnershipExportHistory(user);
    return NextResponse.json({ history });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
