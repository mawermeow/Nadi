import { and, eq, gt, lte } from 'drizzle-orm';

import {
  items,
  records,
  syncDeviceSessions,
  syncOperationReceipts,
} from '@/db/schema';
import { getDb } from '@/lib/db/client';

export async function findSyncItemById(itemId: string) {
  const db = getDb();
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  return item ?? null;
}

export async function findSyncItemByIdForUser(itemId: string, userId: string) {
  const db = getDb();
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .limit(1);
  return item ?? null;
}

export async function createSyncItemRecord(input: typeof items.$inferInsert) {
  const db = getDb();
  const [item] = await db.insert(items).values(input).returning();
  return item;
}

export async function updateSyncItemRecord(
  itemId: string,
  userId: string,
  input: Partial<typeof items.$inferInsert>,
) {
  const db = getDb();
  const [item] = await db
    .update(items)
    .set(input)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .returning();
  return item ?? null;
}

export async function listSyncItemsByUserId(userId: string, lastPulledAt?: Date) {
  const db = getDb();
  return db.query.items.findMany({
    where:
      lastPulledAt === undefined
        ? eq(items.userId, userId)
        : and(eq(items.userId, userId), gt(items.updatedAt, lastPulledAt)),
  });
}

export async function listSyncItemChangesByUserId(
  userId: string,
  input: {
    since?: Date;
    until: Date;
  },
) {
  const db = getDb();
  return db.query.items.findMany({
    where:
      input.since === undefined
        ? and(eq(items.userId, userId), lte(items.updatedAt, input.until))
        : and(
            eq(items.userId, userId),
            gt(items.updatedAt, input.since),
            lte(items.updatedAt, input.until),
          ),
  });
}

export async function findSyncRecordById(recordId: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(records)
    .where(eq(records.id, recordId))
    .limit(1);
  return record ?? null;
}

export async function findSyncRecordByIdForUser(recordId: string, userId: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(records)
    .where(and(eq(records.id, recordId), eq(records.userId, userId)))
    .limit(1);
  return record ?? null;
}

export async function createSyncRecordRecord(input: typeof records.$inferInsert) {
  const db = getDb();
  const [record] = await db.insert(records).values(input).returning();
  return record;
}

export async function updateSyncRecordRecord(
  recordId: string,
  userId: string,
  input: Partial<typeof records.$inferInsert>,
) {
  const db = getDb();
  const [record] = await db
    .update(records)
    .set(input)
    .where(and(eq(records.id, recordId), eq(records.userId, userId)))
    .returning();
  return record ?? null;
}

export async function listSyncRecordsByUserId(userId: string, lastPulledAt?: Date) {
  const db = getDb();
  return db.query.records.findMany({
    where:
      lastPulledAt === undefined
        ? eq(records.userId, userId)
        : and(eq(records.userId, userId), gt(records.updatedAt, lastPulledAt)),
  });
}

export async function listSyncRecordChangesByUserId(
  userId: string,
  input: {
    since?: Date;
    until: Date;
  },
) {
  const db = getDb();
  return db.query.records.findMany({
    where:
      input.since === undefined
        ? and(eq(records.userId, userId), lte(records.updatedAt, input.until))
        : and(
            eq(records.userId, userId),
            gt(records.updatedAt, input.since),
            lte(records.updatedAt, input.until),
          ),
  });
}

export async function findSyncDeviceSessionByUserAndDeviceId(
  userId: string,
  deviceId: string,
) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(syncDeviceSessions)
    .where(
      and(
        eq(syncDeviceSessions.userId, userId),
        eq(syncDeviceSessions.deviceId, deviceId),
      ),
    )
    .limit(1);
  return session ?? null;
}

export async function upsertSyncDeviceSession(
  input: typeof syncDeviceSessions.$inferInsert,
) {
  const db = getDb();
  const [session] = await db
    .insert(syncDeviceSessions)
    .values(input)
    .onConflictDoUpdate({
      target: [syncDeviceSessions.userId, syncDeviceSessions.deviceId],
      set: {
        lastSeenAt: input.lastSeenAt,
        lastSyncStartedAt: input.lastSyncStartedAt ?? null,
        lastSyncCompletedAt: input.lastSyncCompletedAt ?? null,
        lastPushAt: input.lastPushAt ?? null,
        lastPullAt: input.lastPullAt ?? null,
        lastCheckpointAt: input.lastCheckpointAt ?? null,
        lastCheckpointCursor: input.lastCheckpointCursor ?? null,
        lastSyncStatus: input.lastSyncStatus,
        lastErrorCode: input.lastErrorCode ?? null,
        lastErrorAt: input.lastErrorAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return session;
}

export async function findSyncOperationReceiptByUserAndOperationId(
  userId: string,
  operationId: string,
) {
  const db = getDb();
  const [receipt] = await db
    .select()
    .from(syncOperationReceipts)
    .where(
      and(
        eq(syncOperationReceipts.userId, userId),
        eq(syncOperationReceipts.operationId, operationId),
      ),
    )
    .limit(1);
  return receipt ?? null;
}

export async function upsertSyncOperationReceipt(
  input: typeof syncOperationReceipts.$inferInsert,
) {
  const db = getDb();
  const [receipt] = await db
    .insert(syncOperationReceipts)
    .values(input)
    .onConflictDoUpdate({
      target: [
        syncOperationReceipts.userId,
        syncOperationReceipts.operationId,
      ],
      set: {
        deviceId: input.deviceId,
        entityType: input.entityType,
        operationType: input.operationType,
        entityId: input.entityId,
        outcome: input.outcome,
        baseVersion: input.baseVersion ?? null,
        resultingVersion: input.resultingVersion ?? null,
        currentVersion: input.currentVersion ?? null,
        reasonCode: input.reasonCode ?? null,
        message: input.message ?? null,
        clientCreatedAt: input.clientCreatedAt,
        clientUpdatedAt: input.clientUpdatedAt,
        entityUpdatedAt: input.entityUpdatedAt ?? null,
        serverRecordedAt: input.serverRecordedAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  return receipt;
}
