import { randomUUID } from 'node:crypto';

import type { ExportHistory } from '@/db/schema';
import { items, reportSnapshots, records } from '@/db/schema';
import { ensureSessionUserRecord } from '@/features/auth/service';
import { getDb } from '@/lib/db/client';
import type { SessionUser } from '@/lib/auth/session';
import { AppError } from '@/lib/validation/errors';

import type {
  ExportFormat,
  ExportHistoryResponse,
  ImportPreviewResponse,
  OwnershipCloudSummaryResponse,
} from './api';
import type { ExportRequestInput, OwnershipBackupInput } from './schema';
import { ownershipBackupSchema } from './schema';
import {
  createExportHistoryRecord,
  findExistingImportIdsForUser,
  getOwnershipCloudCounts,
  listDeviceOwnershipRowsByUserId,
  listExportHistoriesByUserId,
  listExportItemsByUserId,
  listExportRecordsByUserId,
  listReportSnapshotsByUserId,
} from './repository';

const OWNERSHIP_SCHEMA_VERSION = 1;

function maskUserReference(user: SessionUser) {
  const [name, domain = ''] = user.email.split('@');
  const maskedName =
    name.length <= 2 ? `${name[0] ?? '*'}*` : `${name.slice(0, 2)}***`;
  const maskedDomain = domain ? `@${domain}` : '';
  return `${maskedName}${maskedDomain}`;
}

function buildFileName(format: ExportFormat, createdAt: Date) {
  const stamp = createdAt.toISOString().replaceAll(':', '-');
  if (format === 'csv') {
    return `Nadi-records-export-${stamp}.csv`;
  }

  if (format === 'json') {
    return `Nadi-data-export-${stamp}.json`;
  }

  return `Nadi-full-backup-${stamp}.json`;
}

function mapExportHistory(history: ExportHistory): ExportHistoryResponse {
  return {
    id: history.id,
    exportFormat: history.exportFormat,
    fileName: history.fileName,
    schemaVersion: history.schemaVersion,
    itemCount: history.itemCount,
    recordCount: history.recordCount,
    reportSnapshotCount: history.reportSnapshotCount,
    deviceCount: history.deviceCount,
    maskedUserReference: history.maskedUserReference,
    createdAt: history.createdAt.toISOString(),
  };
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

async function buildBackupPayload(user: SessionUser, exportFormat: ExportFormat) {
  await ensureSessionUserRecord(user);

  const [ownedItems, ownedRecords, snapshots, devices] = await Promise.all([
    listExportItemsByUserId(user.id),
    listExportRecordsByUserId(user.id),
    listReportSnapshotsByUserId(user.id),
    listDeviceOwnershipRowsByUserId(user.id),
  ]);
  const createdAt = new Date();
  const userReference = maskUserReference(user);

  const deviceMap = new Map<
    string,
    OwnershipCloudSummaryResponse['devices'][number]
  >();

  for (const link of devices.links) {
    deviceMap.set(link.deviceId, {
      deviceId: link.deviceId,
      linkedAt: link.linkedAt.toISOString(),
      lastSeenAt: link.lastSeenAt.toISOString(),
      lastMergedAt: link.lastMergedAt?.toISOString() ?? null,
      lastSyncCompletedAt: null,
      lastSyncStatus: 'unknown',
      lastErrorCode: null,
    });
  }

  for (const session of devices.sessions) {
    const current = deviceMap.get(session.deviceId);
    deviceMap.set(session.deviceId, {
      deviceId: session.deviceId,
      linkedAt: current?.linkedAt ?? null,
      lastSeenAt: session.lastSeenAt.toISOString(),
      lastMergedAt: current?.lastMergedAt ?? null,
      lastSyncCompletedAt: session.lastSyncCompletedAt?.toISOString() ?? null,
      lastSyncStatus: session.lastSyncStatus,
      lastErrorCode: session.lastErrorCode,
    });
  }

  const payload = {
    schemaVersion: OWNERSHIP_SCHEMA_VERSION,
    exportedAt: createdAt.toISOString(),
    exportFormat,
    userReference,
    items: ownedItems.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      unit: item.unit,
      valueType: item.valueType,
      scaleMin: item.scaleMin,
      scaleMax: item.scaleMax,
      sortOrder: item.sortOrder,
      archived: item.archived,
      version: item.version,
      deletedAt: item.deletedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
      deviceId: item.deviceId,
    })),
    records: ownedRecords.map((record) => ({
      id: record.id,
      itemId: record.itemId,
      valueNumber: record.valueNumber,
      valueText: record.valueText,
      valueBoolean: record.valueBoolean,
      recordedAt: record.recordedAt.toISOString(),
      note: record.note,
      version: record.version,
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
      deviceId: record.deviceId,
    })),
    reportSnapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      reportType: snapshot.reportType,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      resultJson: snapshot.resultJson,
      createdAt: snapshot.createdAt.toISOString(),
    })),
    devices: Array.from(deviceMap.values()).map((device) => ({
      deviceId: device.deviceId,
      linkedAt: device.linkedAt,
      lastSeenAt: device.lastSeenAt,
      lastMergedAt: device.lastMergedAt,
      lastSyncCompletedAt: device.lastSyncCompletedAt,
      lastSyncStatus: device.lastSyncStatus,
      lastErrorCode: device.lastErrorCode,
    })),
  };

  return {
    payload,
    createdAt,
    counts: {
      itemCount: ownedItems.length,
      recordCount: ownedRecords.length,
      reportSnapshotCount: snapshots.length,
      deviceCount: payload.devices.length,
    },
  };
}

async function recordExportHistory(input: {
  user: SessionUser;
  format: ExportFormat;
  fileName: string;
  itemCount: number;
  recordCount: number;
  reportSnapshotCount: number;
  deviceCount: number;
}) {
  return createExportHistoryRecord({
    id: randomUUID(),
    userId: input.user.id,
    exportFormat: input.format,
    fileName: input.fileName,
    schemaVersion: OWNERSHIP_SCHEMA_VERSION,
    itemCount: input.itemCount,
    recordCount: input.recordCount,
    reportSnapshotCount: input.reportSnapshotCount,
    deviceCount: input.deviceCount,
    maskedUserReference: maskUserReference(input.user),
  });
}

export async function createOwnershipExport(
  user: SessionUser,
  input: ExportRequestInput,
) {
  const format = input.format;
  const { payload, createdAt, counts } = await buildBackupPayload(user, format);
  const fileName = buildFileName(format, createdAt);

  await recordExportHistory({
    user,
    format,
    fileName,
    ...counts,
  });

  if (format === 'csv') {
    const header = [
      'record_id',
      'item_id',
      'item_title',
      'item_type',
      'value_type',
      'value',
      'unit',
      'recorded_at',
      'note',
      'record_version',
      'record_updated_at',
      'item_archived',
    ];
    const itemById = new Map(payload.items.map((item) => [item.id, item]));
    const rows = payload.records.map((record) => {
      const item = itemById.get(record.itemId);
      const rawValue =
        record.valueNumber ?? record.valueText ?? record.valueBoolean ?? '';

      return [
        record.id,
        record.itemId,
        item?.title ?? '',
        item?.type ?? '',
        item?.valueType ?? '',
        rawValue,
        item?.unit ?? '',
        record.recordedAt,
        record.note ?? '',
        record.version,
        record.updatedAt,
        item?.archived ?? false,
      ]
        .map(escapeCsv)
        .join(',');
    });

    return {
      fileName,
      contentType: 'text/csv; charset=utf-8',
      body: [header.join(','), ...rows].join('\n'),
    };
  }

  const exportBody =
    format === 'json'
      ? {
          schemaVersion: payload.schemaVersion,
          exportedAt: payload.exportedAt,
          exportFormat: payload.exportFormat,
          userReference: payload.userReference,
          items: payload.items,
          records: payload.records,
          reportSnapshots: payload.reportSnapshots,
        }
      : payload;

  return {
    fileName,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(exportBody, null, 2),
  };
}

export async function listOwnershipExportHistory(user: SessionUser) {
  await ensureSessionUserRecord(user);
  const histories = await listExportHistoriesByUserId(user.id);
  return histories.map(mapExportHistory);
}

export async function getOwnershipCloudSummary(user: SessionUser) {
  await ensureSessionUserRecord(user);
  const [cloudCounts, devices] = await Promise.all([
    getOwnershipCloudCounts(user.id),
    listDeviceOwnershipRowsByUserId(user.id),
  ]);
  const deviceMap = new Map<
    string,
    OwnershipCloudSummaryResponse['devices'][number]
  >();

  for (const link of devices.links) {
    deviceMap.set(link.deviceId, {
      deviceId: link.deviceId,
      linkedAt: link.linkedAt.toISOString(),
      lastSeenAt: link.lastSeenAt.toISOString(),
      lastMergedAt: link.lastMergedAt?.toISOString() ?? null,
      lastSyncCompletedAt: null,
      lastSyncStatus: 'unknown',
      lastErrorCode: null,
    });
  }

  for (const session of devices.sessions) {
    const current = deviceMap.get(session.deviceId);
    deviceMap.set(session.deviceId, {
      deviceId: session.deviceId,
      linkedAt: current?.linkedAt ?? null,
      lastSeenAt: session.lastSeenAt.toISOString(),
      lastMergedAt: current?.lastMergedAt ?? null,
      lastSyncCompletedAt: session.lastSyncCompletedAt?.toISOString() ?? null,
      lastSyncStatus: session.lastSyncStatus,
      lastErrorCode: session.lastErrorCode,
    });
  }

  return {
    cloud: {
      itemCount: cloudCounts.itemCount,
      recordCount: cloudCounts.recordCount,
      reportSnapshotCount: cloudCounts.reportSnapshotCount,
      exportHistoryCount: cloudCounts.exportHistoryCount,
      lastExportAt: cloudCounts.lastExportAt?.toISOString() ?? null,
    },
    devices: Array.from(deviceMap.values()),
  } satisfies OwnershipCloudSummaryResponse;
}

export async function previewOwnershipImport(
  user: SessionUser,
  payload: unknown,
): Promise<ImportPreviewResponse> {
  await ensureSessionUserRecord(user);
  const parsed = ownershipBackupSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError('匯入資料格式不正確', 400, 'IMPORT_PAYLOAD_INVALID', {
      issues: parsed.error.flatten(),
    });
  }

  const backup = parsed.data;

  if (backup.schemaVersion !== OWNERSHIP_SCHEMA_VERSION) {
    return {
      format:
        backup.exportFormat === 'full_backup' ? 'full_backup' : 'json',
      schemaVersion: backup.schemaVersion,
      summary: {
        itemCount: backup.items.length,
        recordCount: backup.records.length,
        reportSnapshotCount: backup.reportSnapshots.length,
        deviceCount: backup.devices.length,
      },
      duplicates: {
        items: 0,
        records: 0,
        reportSnapshots: 0,
      },
      conflicts: [
        {
          kind: 'schema_mismatch',
          message: `目前只支援 schema version ${OWNERSHIP_SCHEMA_VERSION}，收到 ${backup.schemaVersion}。`,
        },
      ],
      canApply: false,
      requiresConfirmation: true,
    };
  }

  const existing = await findExistingImportIdsForUser(user.id, {
    itemIds: backup.items.map((item) => item.id),
    recordIds: backup.records.map((record) => record.id),
    reportSnapshotIds: backup.reportSnapshots.map((snapshot) => snapshot.id),
  });

  const conflicts: ImportPreviewResponse['conflicts'] = [
    ...existing.itemIds.map((id) => ({
      kind: 'duplicate_item' as const,
      message: `已有相同項目 id：${id}`,
    })),
    ...existing.recordIds.map((id) => ({
      kind: 'duplicate_record' as const,
      message: `已有相同紀錄 id：${id}`,
    })),
    ...existing.reportSnapshotIds.map((id) => ({
      kind: 'duplicate_report_snapshot' as const,
      message: `已有相同報表快照 id：${id}`,
    })),
  ];

  return {
    format: backup.exportFormat === 'full_backup' ? 'full_backup' : 'json',
    schemaVersion: backup.schemaVersion,
    summary: {
      itemCount: backup.items.length,
      recordCount: backup.records.length,
      reportSnapshotCount: backup.reportSnapshots.length,
      deviceCount: backup.devices.length,
    },
    duplicates: {
      items: existing.itemIds.length,
      records: existing.recordIds.length,
      reportSnapshots: existing.reportSnapshotIds.length,
    },
    conflicts,
    canApply: conflicts.length === 0,
    requiresConfirmation: true,
  };
}

export async function applyBackupRecovery(
  user: SessionUser,
  backup: OwnershipBackupInput,
) {
  await ensureSessionUserRecord(user);

  const preview = await previewOwnershipImport(user, backup);

  if (!preview.canApply) {
    throw new AppError(
      '目前無法直接恢復這份備份，請先處理重複或 schema mismatch。',
      409,
      'BACKUP_RECOVERY_BLOCKED',
      { preview },
    );
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.insert(items).values(
      backup.items.map((item) => ({
        id: item.id,
        userId: user.id,
        title: item.title,
        type: item.type,
        unit: item.unit,
        valueType: item.valueType,
        scaleMin: item.scaleMin,
        scaleMax: item.scaleMax,
        sortOrder: item.sortOrder,
        archived: item.archived,
        syncStatus: 'synced' as const,
        version: item.version,
        deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
        lastSyncedAt: item.lastSyncedAt ? new Date(item.lastSyncedAt) : null,
        deviceId: item.deviceId,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    );

    await tx.insert(records).values(
      backup.records.map((record) => ({
        id: record.id,
        userId: user.id,
        itemId: record.itemId,
        valueNumber: record.valueNumber,
        valueText: record.valueText,
        valueBoolean: record.valueBoolean,
        recordedAt: new Date(record.recordedAt),
        note: record.note,
        syncStatus: 'synced' as const,
        version: record.version,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        lastSyncedAt: record.lastSyncedAt ? new Date(record.lastSyncedAt) : null,
        deviceId: record.deviceId,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })),
    );

    if (backup.reportSnapshots.length > 0) {
      await tx.insert(reportSnapshots).values(
        backup.reportSnapshots.map((snapshot) => ({
          id: snapshot.id,
          userId: user.id,
          reportType: snapshot.reportType,
          fromDate: snapshot.fromDate,
          toDate: snapshot.toDate,
          resultJson: snapshot.resultJson,
          createdAt: new Date(snapshot.createdAt),
        })),
      );
    }
  });

  return {
    restored: {
      items: backup.items.length,
      records: backup.records.length,
      reportSnapshots: backup.reportSnapshots.length,
    },
  };
}
