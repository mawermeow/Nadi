import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { items } from '@/db/schema';
import { getDb } from '@/lib/db/client';

export async function listItemsByUserId(
  userId: string,
  options?: {
    includeArchived?: boolean;
  },
) {
  const db = getDb();
  const includeArchived = options?.includeArchived ?? false;

  return db.query.items.findMany({
    where: includeArchived
      ? and(eq(items.userId, userId), isNull(items.deletedAt))
      : and(
          eq(items.userId, userId),
          eq(items.archived, false),
          isNull(items.deletedAt),
        ),
    orderBy: [asc(items.type), asc(items.sortOrder), desc(items.createdAt)],
  });
}

export async function findLastItemSortOrderByUserAndType(
  userId: string,
  type: (typeof items.$inferSelect)['type'],
) {
  const db = getDb();
  const [item] = await db
    .select({ sortOrder: items.sortOrder })
    .from(items)
    .where(and(eq(items.userId, userId), eq(items.type, type), isNull(items.deletedAt)))
    .orderBy(desc(items.sortOrder), desc(items.createdAt))
    .limit(1);

  return item?.sortOrder ?? null;
}

export async function createItemRecord(input: typeof items.$inferInsert) {
  const db = getDb();
  const [item] = await db.insert(items).values(input).returning();
  return item;
}

export async function findItemByIdForUser(itemId: string, userId: string) {
  const db = getDb();
  return db.query.items.findFirst({
    where: and(
      eq(items.id, itemId),
      eq(items.userId, userId),
      isNull(items.deletedAt),
    ),
  });
}

export async function findItemById(itemId: string) {
  const db = getDb();
  return db.query.items.findFirst({
    where: eq(items.id, itemId),
  });
}

export async function updateItemRecord(
  itemId: string,
  userId: string,
  input: Partial<typeof items.$inferInsert>,
) {
  const db = getDb();
  const [item] = await db
    .update(items)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, userId), isNull(items.deletedAt)))
    .returning();

  return item ?? null;
}
