import { and, eq } from 'drizzle-orm';

import { deviceAccountLinks, users } from '@/db/schema';
import { getDb } from '@/lib/db/client';

export async function upsertUser(input: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}) {
  const db = getDb();

  await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      name: input.name,
      emailVerified: input.emailVerified,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        name: input.name,
        emailVerified: input.emailVerified,
        updatedAt: new Date(),
      },
    });
}

export async function findDeviceAccountLinkByDeviceId(deviceId: string) {
  const db = getDb();

  const [link] = await db
    .select()
    .from(deviceAccountLinks)
    .where(eq(deviceAccountLinks.deviceId, deviceId))
    .limit(1);

  return link ?? null;
}

export async function upsertDeviceAccountLink(input: {
  id: string;
  userId: string;
  deviceId: string;
  linkedAt: Date;
  lastSeenAt: Date;
  lastMergedAt?: Date | null;
}) {
  const db = getDb();

  const [link] = await db
    .insert(deviceAccountLinks)
    .values({
      id: input.id,
      userId: input.userId,
      deviceId: input.deviceId,
      linkedAt: input.linkedAt,
      lastSeenAt: input.lastSeenAt,
      lastMergedAt: input.lastMergedAt ?? null,
    })
    .onConflictDoUpdate({
      target: deviceAccountLinks.deviceId,
      set: {
        userId: input.userId,
        linkedAt: input.linkedAt,
        lastSeenAt: input.lastSeenAt,
        lastMergedAt: input.lastMergedAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return link;
}

export async function touchDeviceAccountLink(input: {
  userId: string;
  deviceId: string;
  lastSeenAt: Date;
  lastMergedAt?: Date | null;
}) {
  const db = getDb();

  const [link] = await db
    .update(deviceAccountLinks)
    .set({
      lastSeenAt: input.lastSeenAt,
      lastMergedAt: input.lastMergedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deviceAccountLinks.userId, input.userId),
        eq(deviceAccountLinks.deviceId, input.deviceId),
      ),
    )
    .returning();

  return link ?? null;
}
