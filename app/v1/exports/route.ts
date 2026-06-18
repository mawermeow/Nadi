import { NextResponse } from 'next/server';

import { createOwnershipExport } from '@/features/ownership/service';
import { exportRequestSchema } from '@/features/ownership/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = exportRequestSchema.parse(await request.json());
    const result = await createOwnershipExport(user, payload);

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        'content-type': result.contentType,
        'content-disposition': `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
