import { NextRequest, NextResponse } from 'next/server';

import { linkDeviceToSessionUser } from '@/features/auth/service';
import { deviceLinkRequestSchema } from '@/features/auth/schema';
import { requireUser } from '@/lib/auth/require-user';
import { toApiError } from '@/lib/validation/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const payload = deviceLinkRequestSchema.parse(await request.json());
    const result = await linkDeviceToSessionUser({
      user,
      ...payload,
    });

    return NextResponse.json({
      deviceLink: {
        userId: result.link.userId,
        deviceId: result.link.deviceId,
        linkedAt: result.link.linkedAt.toISOString(),
        lastSeenAt: result.link.lastSeenAt.toISOString(),
        lastMergedAt: result.link.lastMergedAt?.toISOString() ?? null,
      },
      requiresLocalMerge: result.requiresLocalMerge,
    });
  } catch (error) {
    const { statusCode, body } = toApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
