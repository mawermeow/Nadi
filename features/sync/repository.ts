import { and, eq, gt } from 'drizzle-orm';

import { items, records } from '@/db/schema';
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
