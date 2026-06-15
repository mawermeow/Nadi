import { z } from 'zod';

import { itemIdParamSchema, itemValueTypeSchema } from '@/features/items/schema';

const optionalNoteSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().trim().max(500, '備註最多 500 個字').optional());

const isoDateStringSchema = z
  .string()
  .datetime({ offset: true, message: '請提供有效的日期時間' });

export const recordIdParamSchema = z.uuid('無效的 recordId');

export const recordValueSchema = z.union([
  z.number(),
  z.boolean(),
  z.string(),
]);

export const createRecordSchema = z.object({
  itemId: itemIdParamSchema,
  value: recordValueSchema,
  recordedAt: isoDateStringSchema,
  note: optionalNoteSchema,
});

export const updateRecordSchema = z
  .object({
    itemId: itemIdParamSchema.optional(),
    value: recordValueSchema.optional(),
    recordedAt: isoDateStringSchema.optional(),
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

export const listRecordsQuerySchema = z
  .object({
    itemId: itemIdParamSchema.optional(),
    from: isoDateStringSchema.optional(),
    to: isoDateStringSchema.optional(),
  })
  .superRefine((value, context) => {
    if ((value.from && !value.to) || (!value.from && value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: '日期範圍需同時提供開始與結束時間',
      });
    }

    if (value.from && value.to) {
      const from = new Date(value.from);
      const to = new Date(value.to);

      if (from > to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: '結束時間必須晚於開始時間',
        });
      }
    }
  });

export const recordValueTypeSchema = itemValueTypeSchema;

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
