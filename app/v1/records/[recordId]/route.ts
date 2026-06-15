import { NextResponse } from 'next/server';

import { deleteRecordForUser, updateRecordForUser } from '@/features/records/service';
import { updateRecordSchema } from '@/features/records/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  try {
    const user = await requireUser();
    const { recordId } = await context.params;
    const payload = updateRecordSchema.parse(await request.json());
    const record = await updateRecordForUser(user, recordId, payload);

    return NextResponse.json(record);
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  try {
    const user = await requireUser();
    const { recordId } = await context.params;

    await deleteRecordForUser(user, recordId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
