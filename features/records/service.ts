import { randomUUID } from 'node:crypto';

import { ensureSessionUserRecord } from '@/features/auth/service';
import { findItemByIdForUser } from '@/features/items/repository';
import type { SessionUser } from '@/lib/auth/session';
import { normalizeRange } from '@/lib/date/range';
import { AppError } from '@/lib/validation/errors';

import type {
  CreateRecordInput,
  ListRecordsQuery,
  UpdateRecordInput,
} from './schema';
import {
  createRecordSchema,
  listRecordsQuerySchema,
  recordIdParamSchema,
  updateRecordSchema,
} from './schema';
import {
  createRecordRecord,
  deleteRecordByIdForUser,
  findRecordByIdForUser,
  listRecordsByUserId,
  updateRecordByIdForUser,
} from './repository';
import type { RecordResponse } from './api';

function mapRecordValue(record: {
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueText: string | null;
}) {
  switch (record.valueType) {
    case 'number':
    case 'scale':
      return record.valueNumber ?? 0;
    case 'boolean':
      return record.valueBoolean ?? false;
    case 'text':
      return record.valueText ?? '';
  }
}

function validateRecordValue(
  item: Awaited<ReturnType<typeof findItemByIdForUser>>,
  value: number | boolean | string,
) {
  if (!item) {
    throw new AppError('找不到對應的項目', 404, 'ITEM_NOT_FOUND');
  }

  if (item.archived) {
    throw new AppError(
      '已封存項目不能建立新紀錄',
      400,
      'ITEM_ARCHIVED',
    );
  }

  switch (item.valueType) {
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new AppError('此項目需要數字值', 400, 'RECORD_VALUE_INVALID');
      }

      return {
        valueNumber: value,
        valueBoolean: null,
        valueText: null,
      };
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new AppError('此項目需要是 / 否值', 400, 'RECORD_VALUE_INVALID');
      }

      return {
        valueNumber: null,
        valueBoolean: value,
        valueText: null,
      };
    }
    case 'scale': {
      if (
        typeof value !== 'number' ||
        Number.isNaN(value) ||
        !Number.isInteger(value)
      ) {
        throw new AppError('量表紀錄必須是整數', 400, 'RECORD_VALUE_INVALID');
      }

      const min = item.scaleMin ?? 0;
      const max = item.scaleMax ?? 0;

      if (value < min || value > max) {
        throw new AppError(
          `量表紀錄需介於 ${min} 到 ${max} 之間`,
          400,
          'RECORD_SCALE_OUT_OF_RANGE',
        );
      }

      return {
        valueNumber: value,
        valueBoolean: null,
        valueText: null,
      };
    }
    case 'text': {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new AppError('此項目需要文字內容', 400, 'RECORD_VALUE_INVALID');
      }

      return {
        valueNumber: null,
        valueBoolean: null,
        valueText: value.trim(),
      };
    }
  }
}

function toRecordResponse(record: Awaited<ReturnType<typeof listRecordsByUserId>>[number]): RecordResponse {
  return {
    id: record.id,
    itemId: record.itemId,
    itemTitle: record.itemTitle,
    itemType: record.itemType,
    valueType: record.valueType,
    value: mapRecordValue(record),
    unit: record.unit ?? undefined,
    recordedAt: record.recordedAt.toISOString(),
    note: record.note ?? undefined,
    itemArchived: record.itemArchived,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listRecordsForUser(
  user: SessionUser,
  query?: ListRecordsQuery,
) {
  await ensureSessionUserRecord(user);

  const validatedQuery = listRecordsQuerySchema.parse(query ?? {});
  const options: Parameters<typeof listRecordsByUserId>[1] = {};

  if (validatedQuery.itemId) {
    const item = await findItemByIdForUser(validatedQuery.itemId, user.id);

    if (!item) {
      throw new AppError('找不到對應的項目', 404, 'ITEM_NOT_FOUND');
    }

    options.itemId = validatedQuery.itemId;
  }

  if (validatedQuery.itemType) {
    options.itemType = validatedQuery.itemType;
  }

  if (validatedQuery.from && validatedQuery.to) {
    const range = normalizeRange(
      new Date(validatedQuery.from),
      new Date(validatedQuery.to),
    );

    options.from = range.from;
    options.to = range.to;
    options.limit = 100;
  }

  const records = await listRecordsByUserId(user.id, options);
  return records.map(toRecordResponse);
}

export async function createRecordForUser(
  user: SessionUser,
  input: CreateRecordInput,
) {
  await ensureSessionUserRecord(user);

  const validatedInput = createRecordSchema.parse(input);
  const item = await findItemByIdForUser(validatedInput.itemId, user.id);
  const recordValue = validateRecordValue(item, validatedInput.value);
  const record = await createRecordRecord({
    id: randomUUID(),
    userId: user.id,
    itemId: validatedInput.itemId,
    recordedAt: new Date(validatedInput.recordedAt),
    note: validatedInput.note ?? null,
    ...recordValue,
  });

  const records = await listRecordsByUserId(user.id, {
    itemId: record.itemId,
    from: record.recordedAt,
    to: record.recordedAt,
    limit: 10,
  });
  const matching = records.find((currentRecord) => currentRecord.id === record.id);

  if (!matching) {
    throw new AppError('建立紀錄後找不到資料', 500, 'RECORD_CREATE_FAILED');
  }

  return toRecordResponse(matching);
}

export async function deleteRecordForUser(user: SessionUser, recordId: string) {
  await ensureSessionUserRecord(user);

  const validatedRecordId = recordIdParamSchema.parse(recordId);
  const existingRecord = await findRecordByIdForUser(validatedRecordId, user.id);

  if (!existingRecord) {
    throw new AppError('找不到這筆紀錄', 404, 'RECORD_NOT_FOUND');
  }

  await deleteRecordByIdForUser(validatedRecordId, user.id);
}

export async function updateRecordForUser(
  user: SessionUser,
  recordId: string,
  input: UpdateRecordInput,
) {
  await ensureSessionUserRecord(user);

  const validatedRecordId = recordIdParamSchema.parse(recordId);
  const validatedInput = updateRecordSchema.parse(input);
  const existingRecord = await findRecordByIdForUser(validatedRecordId, user.id);

  if (!existingRecord) {
    throw new AppError('找不到這筆紀錄', 404, 'RECORD_NOT_FOUND');
  }

  const itemId = validatedInput.itemId ?? existingRecord.itemId;
  const item = await findItemByIdForUser(itemId, user.id);
  const nextValue =
    validatedInput.value ?? mapRecordValue({
      valueType: item?.valueType ?? 'text',
      valueNumber: existingRecord.valueNumber,
      valueBoolean: existingRecord.valueBoolean,
      valueText: existingRecord.valueText,
    });
  const valueFields = validateRecordValue(item, nextValue);

  const updatedRecord = await updateRecordByIdForUser(validatedRecordId, user.id, {
    itemId,
    recordedAt: validatedInput.recordedAt
      ? new Date(validatedInput.recordedAt)
      : existingRecord.recordedAt,
    note:
      validatedInput.note === undefined ? existingRecord.note : validatedInput.note,
    ...valueFields,
  });

  if (!updatedRecord) {
    throw new AppError('更新紀錄失敗', 500, 'RECORD_UPDATE_FAILED');
  }

  const records = await listRecordsByUserId(user.id, {
    itemId: updatedRecord.itemId,
    from: updatedRecord.recordedAt,
    to: updatedRecord.recordedAt,
    limit: 10,
  });
  const matching = records.find((currentRecord) => currentRecord.id === updatedRecord.id);

  if (!matching) {
    throw new AppError('更新後找不到紀錄資料', 500, 'RECORD_UPDATE_FAILED');
  }

  return toRecordResponse(matching);
}
