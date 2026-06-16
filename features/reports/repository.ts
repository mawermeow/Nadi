import { and, eq, gte, lte } from 'drizzle-orm';

import { items, records } from '@/db/schema';
import { getDb } from '@/lib/db/client';

export type ReportRecordRow = {
  recordId: string;
  itemId: string;
  itemTitle: string;
  itemType: 'metric' | 'symptom';
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  unit: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueText: string | null;
  recordedAt: Date;
};

export async function listReportRecordsByUserId(
  userId: string,
  range: {
    from: Date;
    to: Date;
  },
): Promise<ReportRecordRow[]> {
  const db = getDb();

  return db
    .select({
      recordId: records.id,
      itemId: items.id,
      itemTitle: items.title,
      itemType: items.type,
      valueType: items.valueType,
      unit: items.unit,
      valueNumber: records.valueNumber,
      valueBoolean: records.valueBoolean,
      valueText: records.valueText,
      recordedAt: records.recordedAt,
    })
    .from(records)
    .innerJoin(items, eq(records.itemId, items.id))
    .where(
      and(
        eq(records.userId, userId),
        gte(records.recordedAt, range.from),
        lte(records.recordedAt, range.to),
      ),
    );
}
