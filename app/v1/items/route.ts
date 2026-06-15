import { NextRequest, NextResponse } from 'next/server';

import { toItemResponse } from '@/features/items/api';
import {
  createItemForUser,
  listItemsForUser,
} from '@/features/items/service';
import {
  createItemSchema,
  listItemsQuerySchema,
} from '@/features/items/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const query = listItemsQuerySchema.parse({
      includeArchived: request.nextUrl.searchParams.get('includeArchived') ?? undefined,
    });
    const items = await listItemsForUser(user, query);

    return NextResponse.json({
      items: items.map(toItemResponse),
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = createItemSchema.parse(await request.json());
    const item = await createItemForUser(user, payload);

    return NextResponse.json(toItemResponse(item), {
      status: 201,
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
