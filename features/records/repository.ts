import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';

import { items, records } from '@/db/schema';
import { getDb } from '@/lib/db/client';

type ListRecordsOptions = {
  itemId?: string;
  itemType?: 'metric' | 'symptom' | 'both';
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function createRecordRecord(input: typeof records.$inferInsert) {
  const db = getDb();
  const [record] = await db.insert(records).values(input).returning();
  return record;
}

export async function updateRecordByIdForUser(
  recordId: string,
  userId: string,
  input: Partial<typeof records.$inferInsert>,
) {
  const db = getDb();

  const [record] = await db
    .update(records)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(eq(records.id, recordId), eq(records.userId, userId), isNull(records.deletedAt)),
    )
    .returning();

  return record ?? null;
}

export async function listRecordsByUserId(
  userId: string,
  options: ListRecordsOptions = {},
) {
  const db = getDb();
  const conditions = [
    eq(records.userId, userId),
    isNull(records.deletedAt),
    isNull(items.deletedAt),
  ];

  if (options.itemId) {
    conditions.push(eq(records.itemId, options.itemId));
  }

  if (options.itemType && options.itemType !== 'both') {
    conditions.push(eq(items.type, options.itemType));
  }

  if (options.from) {
    conditions.push(gte(records.recordedAt, options.from));
  }

  if (options.to) {
    conditions.push(lte(records.recordedAt, options.to));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  return db
    .select({
      id: records.id,
      itemId: records.itemId,
      itemTitle: items.title,
      itemType: items.type,
      itemArchived: items.archived,
      valueType: items.valueType,
      valueNumber: records.valueNumber,
      valueBoolean: records.valueBoolean,
      valueText: records.valueText,
      unit: items.unit,
      recordedAt: records.recordedAt,
      note: records.note,
      syncStatus: records.syncStatus,
      version: records.version,
      createdAt: records.createdAt,
    })
    .from(records)
    .innerJoin(items, eq(records.itemId, items.id))
    .where(where)
    .orderBy(desc(records.recordedAt), desc(records.createdAt))
    .limit(options.limit ?? 20);
}

export async function findRecordByIdForUser(recordId: string, userId: string) {
  const db = getDb();

  const [record] = await db
    .select()
    .from(records)
    .where(
      and(eq(records.id, recordId), eq(records.userId, userId), isNull(records.deletedAt)),
    )
    .limit(1);

  return record ?? null;
}

export async function findRecordById(recordId: string) {
  const db = getDb();

  const [record] = await db
    .select()
    .from(records)
    .where(eq(records.id, recordId))
    .limit(1);

  return record ?? null;
}

export async function softDeleteRecordByIdForUser(
  recordId: string,
  userId: string,
  input: Pick<typeof records.$inferInsert, 'deletedAt' | 'version'>,
) {
  const db = getDb();

  const [deletedRecord] = await db
    .update(records)
    .set({
      deletedAt: input.deletedAt,
      version: input.version,
      updatedAt: new Date(),
    })
    .where(
      and(eq(records.id, recordId), eq(records.userId, userId), isNull(records.deletedAt)),
    )
    .returning();

  return deletedRecord ?? null;
}
