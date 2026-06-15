import { toItemResponse } from '@/features/items/api';
import { ItemDashboard } from '@/features/items/components/item-dashboard';
import { listItemsForUser } from '@/features/items/service';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireUser();
  const items = await listItemsForUser(user, {
    includeArchived: true,
  });

  return (
    <ItemDashboard
      initialItems={items.map(toItemResponse)}
      userEmail={user.email}
    />
  );
}
