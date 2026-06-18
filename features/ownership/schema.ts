import { z } from 'zod';

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: '請提供有效的日期時間' });

const exportFormatSchema = z.enum(['csv', 'json', 'full_backup']);

const backupItemSchema = z.object({
  id: z.uuid('無效的 item id'),
  title: z.string().trim().min(1, '項目名稱不可為空'),
  type: z.enum(['metric', 'symptom']),
  unit: z.string().max(20, '單位最多 20 個字').nullable(),
  valueType: z.enum(['number', 'boolean', 'scale', 'text']),
  scaleMin: z.number().int().nullable(),
  scaleMax: z.number().int().nullable(),
  sortOrder: z.number().int(),
  archived: z.boolean(),
  version: z.number().int().positive(),
  deletedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastSyncedAt: isoDateTimeSchema.nullable(),
  deviceId: z.string().max(120).nullable(),
});

const backupRecordSchema = z.object({
  id: z.uuid('無效的 record id'),
  itemId: z.uuid('無效的 itemId'),
  valueNumber: z.number().nullable(),
  valueText: z.string().max(500).nullable(),
  valueBoolean: z.boolean().nullable(),
  recordedAt: isoDateTimeSchema,
  note: z.string().max(500, '備註最多 500 個字').nullable(),
  version: z.number().int().positive(),
  deletedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastSyncedAt: isoDateTimeSchema.nullable(),
  deviceId: z.string().max(120).nullable(),
});

const backupReportSnapshotSchema = z.object({
  id: z.uuid('無效的 report snapshot id'),
  reportType: z.enum(['summary', 'correlation']),
  fromDate: z.string().min(1, 'fromDate 不可為空'),
  toDate: z.string().min(1, 'toDate 不可為空'),
  resultJson: z.unknown(),
  createdAt: isoDateTimeSchema,
});

const backupDeviceSchema = z.object({
  deviceId: z.string().trim().min(1, '裝置 ID 不可為空'),
  linkedAt: isoDateTimeSchema.nullable(),
  lastSeenAt: isoDateTimeSchema.nullable(),
  lastMergedAt: isoDateTimeSchema.nullable(),
  lastSyncCompletedAt: isoDateTimeSchema.nullable(),
  lastSyncStatus: z
    .enum(['idle', 'syncing', 'synced', 'conflict', 'failed', 'unknown'])
    .default('unknown'),
  lastErrorCode: z.string().nullable(),
});

export const ownershipBackupSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    exportedAt: isoDateTimeSchema,
    exportFormat: exportFormatSchema,
    userReference: z.string().trim().min(1, '缺少 userReference'),
    items: z.array(backupItemSchema),
    records: z.array(backupRecordSchema),
    reportSnapshots: z.array(backupReportSnapshotSchema).default([]),
    devices: z.array(backupDeviceSchema).default([]),
  })
  .superRefine((value, context) => {
    const itemIds = new Set<string>();

    for (const item of value.items) {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: `item id 重複：${item.id}`,
        });
        continue;
      }

      itemIds.add(item.id);

      if (item.valueType === 'scale') {
        if (item.scaleMin === null || item.scaleMax === null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: `量表項目缺少範圍：${item.id}`,
          });
        } else if (item.scaleMin >= item.scaleMax) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: `量表範圍無效：${item.id}`,
          });
        }
      }
    }

    const recordIds = new Set<string>();

    for (const record of value.records) {
      if (recordIds.has(record.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records'],
          message: `record id 重複：${record.id}`,
        });
      }

      recordIds.add(record.id);

      if (!itemIds.has(record.itemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records'],
          message: `找不到對應項目：${record.itemId}`,
        });
      }

      const valueCount = [
        record.valueNumber !== null,
        record.valueText !== null,
        record.valueBoolean !== null,
      ].filter(Boolean).length;

      if (valueCount !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['records'],
          message: `record 值欄位必須且只能有一個：${record.id}`,
        });
      }
    }
  });

export const exportRequestSchema = z.object({
  format: exportFormatSchema,
});

export const importValidationRequestSchema = z.object({
  payload: z.unknown(),
});

export const backupRecoveryRequestSchema = z.object({
  payload: z.unknown(),
  confirmText: z.literal('RESTORE', {
    error: '請輸入 RESTORE 以確認恢復',
  }),
});

export type ExportRequestInput = z.infer<typeof exportRequestSchema>;
export type OwnershipBackupInput = z.infer<typeof ownershipBackupSchema>;
