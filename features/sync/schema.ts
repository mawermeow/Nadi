import { z } from 'zod';

import { itemTypeSchema, itemValueTypeSchema } from '@/features/items/schema';
import { recordValueSchema } from '@/features/records/schema';

const deviceIdSchema = z
  .string()
  .trim()
  .min(1, '請提供 deviceId')
  .max(120, 'deviceId 過長');

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: '請提供有效的日期時間' });

const optionalUnitSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().trim().max(20, '單位最多 20 個字').optional());

const nullableOptionalUnitSchema = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  return value;
}, z.string().trim().max(20, '單位最多 20 個字').nullable().optional());

const optionalIntegerSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.coerce.number().int('請輸入整數').optional());

const nullableOptionalIntegerSchema = z.preprocess((value) => {
  if (value === '' || value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value;
}, z.coerce.number().int('請輸入整數').nullable().optional());

const optionalNoteSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().trim().max(500, '備註最多 500 個字').optional());

const syncItemCreatePayloadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, '請輸入項目名稱')
      .max(80, '項目名稱最多 80 個字'),
    type: itemTypeSchema,
    unit: optionalUnitSchema,
    valueType: itemValueTypeSchema,
    scaleMin: optionalIntegerSchema,
    scaleMax: optionalIntegerSchema,
  })
  .superRefine((value, context) => {
    if (value.valueType === 'scale') {
      if (value.scaleMin === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scaleMin'],
          message: '請輸入量表最小值',
        });
      }

      if (value.scaleMax === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scaleMax'],
          message: '請輸入量表最大值',
        });
      }

      if (
        value.scaleMin !== undefined &&
        value.scaleMax !== undefined &&
        value.scaleMin >= value.scaleMax
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scaleMax'],
          message: '量表最大值必須大於最小值',
        });
      }

      return;
    }

    if (value.scaleMin !== undefined || value.scaleMax !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valueType'],
        message: '只有量表型項目可以設定最小值與最大值',
      });
    }
  });

const syncItemUpdatePayloadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, '請輸入項目名稱')
      .max(80, '項目名稱最多 80 個字')
      .optional(),
    unit: nullableOptionalUnitSchema,
    archived: z.boolean().optional(),
    scaleMin: nullableOptionalIntegerSchema,
    scaleMax: nullableOptionalIntegerSchema,
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.unit !== undefined ||
      value.archived !== undefined ||
      value.scaleMin !== undefined ||
      value.scaleMax !== undefined,
    {
      message: '至少需要更新一個欄位',
    },
  );

const syncRecordCreatePayloadSchema = z.object({
  itemId: z.uuid('無效的 itemId'),
  value: recordValueSchema,
  recordedAt: isoDateTimeSchema,
  note: optionalNoteSchema,
});

const syncRecordUpdatePayloadSchema = z
  .object({
    itemId: z.uuid('無效的 itemId').optional(),
    value: recordValueSchema.optional(),
    recordedAt: isoDateTimeSchema.optional(),
    note: optionalNoteSchema,
  })
  .refine(
    (value) =>
      value.itemId !== undefined ||
      value.value !== undefined ||
      value.recordedAt !== undefined ||
      value.note !== undefined,
    {
      message: '至少需要更新一個欄位',
    },
  );

export const syncEntityTypeSchema = z.enum(['item', 'record']);
export const syncOperationTypeSchema = z.enum(['create', 'update', 'delete']);

export const syncOperationSchema = z
  .object({
    operationId: z.string().trim().min(1, '請提供 operationId'),
    entityType: syncEntityTypeSchema,
    operationType: syncOperationTypeSchema,
    entityId: z.uuid('無效的 entityId'),
    baseVersion: z.coerce
      .number()
      .int('baseVersion 必須是整數')
      .positive('baseVersion 必須是正整數')
      .optional(),
    payload: z.unknown(),
    clientCreatedAt: isoDateTimeSchema,
    clientUpdatedAt: isoDateTimeSchema,
  })
  .superRefine((value, context) => {
    if (
      (value.operationType === 'update' || value.operationType === 'delete') &&
      value.baseVersion === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseVersion'],
        message: 'update / delete 需要提供 baseVersion',
      });
    }

    let payloadResult:
      | ReturnType<typeof syncItemCreatePayloadSchema.safeParse>
      | ReturnType<typeof syncItemUpdatePayloadSchema.safeParse>
      | ReturnType<typeof syncRecordCreatePayloadSchema.safeParse>
      | ReturnType<typeof syncRecordUpdatePayloadSchema.safeParse>
      | null = null;

    if (value.operationType === 'delete') {
      if (
        value.payload !== undefined &&
        value.payload !== null &&
        typeof value.payload === 'object' &&
        Object.keys(value.payload as Record<string, unknown>).length > 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payload'],
          message: 'delete operation 不需要 payload',
        });
      }
      return;
    }

    if (value.entityType === 'item' && value.operationType === 'create') {
      payloadResult = syncItemCreatePayloadSchema.safeParse(value.payload);
    } else if (value.entityType === 'item' && value.operationType === 'update') {
      payloadResult = syncItemUpdatePayloadSchema.safeParse(value.payload);
    } else if (value.entityType === 'record' && value.operationType === 'create') {
      payloadResult = syncRecordCreatePayloadSchema.safeParse(value.payload);
    } else if (value.entityType === 'record' && value.operationType === 'update') {
      payloadResult = syncRecordUpdatePayloadSchema.safeParse(value.payload);
    }

    if (!payloadResult || payloadResult.success) {
      return;
    }

    for (const issue of payloadResult.error.issues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payload', ...issue.path],
        message: issue.message,
      });
    }
  });

export const syncPushRequestSchema = z.object({
  deviceId: deviceIdSchema,
  operations: z.array(syncOperationSchema),
});

export const syncPullRequestSchema = z.object({
  deviceId: deviceIdSchema,
  lastPulledAt: isoDateTimeSchema.optional(),
});

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
export type SyncPushRequestInput = z.infer<typeof syncPushRequestSchema>;
export type SyncPullRequestInput = z.infer<typeof syncPullRequestSchema>;
export type SyncItemCreatePayload = z.infer<typeof syncItemCreatePayloadSchema>;
export type SyncItemUpdatePayload = z.infer<typeof syncItemUpdatePayloadSchema>;
export type SyncRecordCreatePayload = z.infer<typeof syncRecordCreatePayloadSchema>;
export type SyncRecordUpdatePayload = z.infer<typeof syncRecordUpdatePayloadSchema>;
