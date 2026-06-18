import { NextResponse } from 'next/server';

import { previewOwnershipImport } from '@/features/ownership/service';
import { importValidationRequestSchema } from '@/features/ownership/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = importValidationRequestSchema.parse(await request.json());
    const preview = await previewOwnershipImport(user, payload.payload);
    return NextResponse.json(preview);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
