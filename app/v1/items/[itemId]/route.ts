import { NextRequest, NextResponse } from 'next/server';

import { toItemResponse } from '@/features/items/api';
import { updateItemForUser } from '@/features/items/service';
import { updateItemSchema } from '@/features/items/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  try {
    const user = await requireUser();
    const { itemId } = await context.params;
    const payload = updateItemSchema.parse(await request.json());
    const item = await updateItemForUser(user, itemId, payload);

    return NextResponse.json(toItemResponse(item));
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
