import { z } from 'zod';

const itemTypeValues = ['metric', 'symptom'] as const;
const itemValueTypeValues = ['number', 'boolean', 'scale', 'text'] as const;

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

export const itemTypeSchema = z.enum(itemTypeValues);
export const itemValueTypeSchema = z.enum(itemValueTypeValues);

export const itemIdParamSchema = z.uuid('無效的 itemId');

export const listItemsQuerySchema = z.object({
  includeArchived: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true'),
});

export const createItemSchema = z
  .object({
    id: z.uuid('無效的 id').optional(),
    title: z
      .string()
      .trim()
      .min(1, '請輸入項目名稱')
      .max(80, '項目名稱最多 80 個字'),
    type: itemTypeSchema,
    unit: optionalUnitSchema,
    valueType: itemValueTypeSchema,
    sortOrder: z.coerce.number().int().min(0, 'sortOrder 不可小於 0').optional(),
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

export const updateItemSchema = z
  .object({
    version: z.coerce.number().int().positive('version 必須是正整數').optional(),
    title: z
      .string()
      .trim()
      .min(1, '請輸入項目名稱')
      .max(80, '項目名稱最多 80 個字')
      .optional(),
    unit: nullableOptionalUnitSchema,
    archived: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0, 'sortOrder 不可小於 0').optional(),
    scaleMin: nullableOptionalIntegerSchema,
    scaleMax: nullableOptionalIntegerSchema,
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.unit !== undefined ||
      value.archived !== undefined ||
      value.sortOrder !== undefined ||
      value.scaleMin !== undefined ||
      value.scaleMax !== undefined,
    {
      message: '至少需要更新一個欄位',
    },
  );

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
