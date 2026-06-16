import { NextRequest, NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';
import { createRecordSchema, listRecordsQuerySchema } from '@/features/records/schema';
import { createRecordForUser, listRecordsForUser } from '@/features/records/service';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const query = listRecordsQuerySchema.parse({
      itemId: request.nextUrl.searchParams.get('itemId') ?? undefined,
      itemType: request.nextUrl.searchParams.get('itemType') ?? undefined,
      from: request.nextUrl.searchParams.get('from') ?? undefined,
      to: request.nextUrl.searchParams.get('to') ?? undefined,
    });
    const records = await listRecordsForUser(user, query);

    return NextResponse.json({
      records,
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = createRecordSchema.parse(await request.json());
    const record = await createRecordForUser(user, payload);

    return NextResponse.json(record, {
      status: 201,
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
