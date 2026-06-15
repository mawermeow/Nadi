import { toItemResponse } from '@/features/items/api';
import { listItemsForUser } from '@/features/items/service';
import { RecordDashboard } from '@/features/records/components/record-dashboard';
import { listRecordsForUser } from '@/features/records/service';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireUser();
  const items = await listItemsForUser(user, {
    includeArchived: true,
  });
  const records = await listRecordsForUser(user);

  return (
    <RecordDashboard
      initialItems={items.map(toItemResponse)}
      initialRecords={records}
      userEmail={user.email}
    />
  );
}
