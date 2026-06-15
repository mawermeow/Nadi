import { and, desc, eq } from 'drizzle-orm';

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
      ? eq(items.userId, userId)
      : and(eq(items.userId, userId), eq(items.archived, false)),
    orderBy: [desc(items.createdAt)],
  });
}

export async function createItemRecord(input: typeof items.$inferInsert) {
  const db = getDb();
  const [item] = await db.insert(items).values(input).returning();
  return item;
}

export async function findItemByIdForUser(itemId: string, userId: string) {
  const db = getDb();
  return db.query.items.findFirst({
    where: and(eq(items.id, itemId), eq(items.userId, userId)),
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
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .returning();

  return item ?? null;
}
