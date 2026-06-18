import { and, count, desc, eq, inArray } from 'drizzle-orm';

import {
  deviceAccountLinks,
  exportHistories,
  items,
  reportSnapshots,
  records,
  syncDeviceSessions,
} from '@/db/schema';
import { getDb } from '@/lib/db/client';

export async function listExportHistoriesByUserId(userId: string) {
  const db = getDb();
  return db.query.exportHistories.findMany({
    where: eq(exportHistories.userId, userId),
    orderBy: [desc(exportHistories.createdAt)],
  });
}

export async function createExportHistoryRecord(
  input: typeof exportHistories.$inferInsert,
) {
  const db = getDb();
  const [history] = await db.insert(exportHistories).values(input).returning();
  return history;
}

export async function listExportItemsByUserId(userId: string) {
  const db = getDb();
  return db.query.items.findMany({
    where: eq(items.userId, userId),
    orderBy: [desc(items.updatedAt), desc(items.createdAt)],
  });
}

export async function listExportRecordsByUserId(userId: string) {
  const db = getDb();
  return db.query.records.findMany({
    where: eq(records.userId, userId),
    orderBy: [desc(records.recordedAt), desc(records.createdAt)],
  });
}

export async function listReportSnapshotsByUserId(userId: string) {
  const db = getDb();
  return db.query.reportSnapshots.findMany({
    where: eq(reportSnapshots.userId, userId),
    orderBy: [desc(reportSnapshots.createdAt)],
  });
}

export async function listDeviceOwnershipRowsByUserId(userId: string) {
  const db = getDb();
  const links = await db.query.deviceAccountLinks.findMany({
    where: eq(deviceAccountLinks.userId, userId),
    orderBy: [desc(deviceAccountLinks.lastSeenAt)],
  });

  const sessions = await db.query.syncDeviceSessions.findMany({
    where: eq(syncDeviceSessions.userId, userId),
    orderBy: [desc(syncDeviceSessions.lastSeenAt)],
  });

  return { links, sessions };
}

export async function getOwnershipCloudCounts(userId: string) {
  const db = getDb();
  const [itemCountRow, recordCountRow, reportSnapshotCountRow, exportHistoryCountRow] =
    await Promise.all([
      db.select({ value: count() }).from(items).where(eq(items.userId, userId)),
      db.select({ value: count() }).from(records).where(eq(records.userId, userId)),
      db
        .select({ value: count() })
        .from(reportSnapshots)
        .where(eq(reportSnapshots.userId, userId)),
      db
        .select({ value: count() })
        .from(exportHistories)
        .where(eq(exportHistories.userId, userId)),
    ]);

  const histories = await db.query.exportHistories.findMany({
    where: eq(exportHistories.userId, userId),
    orderBy: [desc(exportHistories.createdAt)],
    limit: 1,
  });

  return {
    itemCount: itemCountRow[0]?.value ?? 0,
    recordCount: recordCountRow[0]?.value ?? 0,
    reportSnapshotCount: reportSnapshotCountRow[0]?.value ?? 0,
    exportHistoryCount: exportHistoryCountRow[0]?.value ?? 0,
    lastExportAt: histories[0]?.createdAt ?? null,
  };
}

export async function findExistingImportIdsForUser(
  userId: string,
  input: {
    itemIds: string[];
    recordIds: string[];
    reportSnapshotIds: string[];
  },
) {
  const db = getDb();
  const [existingItems, existingRecords, existingReportSnapshots] = await Promise.all([
    input.itemIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.userId, userId), inArray(items.id, input.itemIds))),
    input.recordIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: records.id })
          .from(records)
          .where(and(eq(records.userId, userId), inArray(records.id, input.recordIds))),
    input.reportSnapshotIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: reportSnapshots.id })
          .from(reportSnapshots)
          .where(
            and(
              eq(reportSnapshots.userId, userId),
              inArray(reportSnapshots.id, input.reportSnapshotIds),
            ),
          ),
  ]);

  return {
    itemIds: existingItems.map((row) => row.id),
    recordIds: existingRecords.map((row) => row.id),
    reportSnapshotIds: existingReportSnapshots.map((row) => row.id),
  };
}
