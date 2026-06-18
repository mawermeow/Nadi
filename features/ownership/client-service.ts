'use client';

import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import { getOrCreateDeviceId } from '@/features/sync/device';
import {
  getLastSyncedAt,
  getStoredDeviceSession,
  getSyncDiagnosticsEvents,
} from '@/features/sync/meta';
import { getActiveLocalDataUserId } from '@/features/sync/local-user-scope';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';

import type {
  BackupRecoveryResponse,
  ExportFormat,
  ExportHistoryResponse,
  ImportPreviewResponse,
  OwnershipCloudSummaryResponse,
  OwnershipSummaryResponse,
} from './api';

async function parseJsonResponse<T>(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message ?? '請求失敗');
  }

  return data as T;
}

export async function downloadOwnershipExport(format: ExportFormat) {
  const response = await fetch('/v1/exports', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ format }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message ?? '匯出失敗');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? `Nadi-export-${format}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return fileName;
}

export async function fetchExportHistory() {
  const data = await parseJsonResponse<{ history: ExportHistoryResponse[] }>(
    await fetch('/v1/exports/history', {
      method: 'GET',
      cache: 'no-store',
    }),
  );

  return data.history;
}

export async function fetchOwnershipSummary(): Promise<OwnershipSummaryResponse> {
  const activeUserId = await getActiveLocalDataUserId();
  const [deviceId, localItems, localRecords, operations, lastSyncedAt, deviceSession, diagnosticsEvents] =
    await Promise.all([
      getOrCreateDeviceId(),
      itemLocalRepository.getAll({ includeDeleted: true, userId: activeUserId }),
      recordLocalRepository.getAll({ includeDeleted: true, userId: activeUserId }),
      syncOperationRepository.getAll({ userId: activeUserId }),
      getLastSyncedAt(),
      getStoredDeviceSession(),
      getSyncDiagnosticsEvents(),
    ]);

  const cloud = await parseJsonResponse<OwnershipCloudSummaryResponse>(
    await fetch('/v1/ownership/summary', {
      method: 'GET',
      cache: 'no-store',
    }),
  );

  const activeLocalItems = localItems.filter((item) => item.deletedAt === null);
  const activeLocalRecords = localRecords.filter((record) => record.deletedAt === null);

  return {
    local: {
      deviceId,
      itemCount: activeLocalItems.length,
      recordCount: activeLocalRecords.length,
      syncedCount:
        activeLocalItems.filter((item) => item.syncStatus === 'synced').length +
        activeLocalRecords.filter((record) => record.syncStatus === 'synced').length,
      localOnlyCount:
        activeLocalItems.filter((item) => item.userId == null).length +
        activeLocalRecords.filter((record) => record.userId == null).length,
      pendingCount: operations.filter((operation) => operation.status === 'pending').length,
      failedCount: operations.filter((operation) => operation.status === 'failed').length,
      conflictCount: operations.filter((operation) => operation.status === 'conflict').length,
    },
    cloud: cloud.cloud,
    sync: {
      lastSyncAt: lastSyncedAt,
      lastSyncStatus:
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : deviceSession?.lastSyncStatus ?? 'idle',
      lastSyncMessage: diagnosticsEvents[0]?.message ?? null,
    },
    devices: cloud.devices.map((device) => ({
      ...device,
      isCurrentDevice: device.deviceId === deviceId,
    })),
  };
}

export async function validateOwnershipImport(payload: unknown) {
  return parseJsonResponse<ImportPreviewResponse>(
    await fetch('/v1/imports/validate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    }),
  );
}

export async function applyBackupRecovery(payload: unknown, confirmText: string) {
  return parseJsonResponse<BackupRecoveryResponse>(
    await fetch('/v1/backups/recover', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ payload, confirmText }),
    }),
  );
}
