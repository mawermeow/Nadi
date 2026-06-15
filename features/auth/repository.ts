import { users } from '@/db/schema';
import { getDb } from '@/lib/db/client';

export async function upsertUser(input: { id: string; email: string }) {
  const db = getDb();

  await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
      },
    });
}
