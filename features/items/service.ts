import { randomUUID } from 'node:crypto';

import type { Item } from '@/db/schema';
import type { SessionUser } from '@/lib/auth/session';
import { AppError } from '@/lib/validation/errors';
import { ensureSessionUserRecord } from '@/features/auth/service';

import type { CreateItemInput, UpdateItemInput } from './schema';
import {
  createItemSchema,
  itemIdParamSchema,
  updateItemSchema,
} from './schema';
import {
  createItemRecord,
  findItemById,
  findItemByIdForUser,
  findLastItemSortOrderByUserAndType,
  listItemsByUserId,
  updateItemRecord,
} from './repository';

function assertScaleConfig(valueType: Item['valueType'], scaleMin: number | null, scaleMax: number | null) {
  if (valueType !== 'scale') {
    if (scaleMin !== null || scaleMax !== null) {
      throw new AppError(
        '只有量表型項目可以設定最小值與最大值',
        400,
        'ITEM_SCALE_CONFIG_INVALID',
      );
    }

    return;
  }

  if (scaleMin === null || scaleMax === null) {
    throw new AppError(
      '量表型項目必須同時設定最小值與最大值',
      400,
      'ITEM_SCALE_CONFIG_REQUIRED',
    );
  }

  if (scaleMin >= scaleMax) {
    throw new AppError(
      '量表最大值必須大於最小值',
      400,
      'ITEM_SCALE_RANGE_INVALID',
    );
  }
}

export async function listItemsForUser(
  user: SessionUser,
  options?: {
    includeArchived?: boolean;
  },
) {
  await ensureSessionUserRecord(user);

  return listItemsByUserId(user.id, options);
}

export async function createItemForUser(user: SessionUser, input: CreateItemInput) {
  await ensureSessionUserRecord(user);

  const validatedInput = createItemSchema.parse(input);
  const nextId = validatedInput.id ?? randomUUID();
  const existingItem = await findItemById(nextId);
  const lastSortOrder = await findLastItemSortOrderByUserAndType(
    user.id,
    validatedInput.type,
  );

  if (existingItem) {
    throw new AppError('這個 id 已存在', 409, 'ITEM_ID_CONFLICT');
  }

  return createItemRecord({
    id: nextId,
    userId: user.id,
    title: validatedInput.title,
    type: validatedInput.type,
    unit: validatedInput.unit ?? null,
    valueType: validatedInput.valueType,
    scaleMin: validatedInput.scaleMin ?? null,
    scaleMax: validatedInput.scaleMax ?? null,
    sortOrder: validatedInput.sortOrder ?? (lastSortOrder ?? -1) + 1,
    archived: false,
  });
}

export async function updateItemForUser(
  user: SessionUser,
  itemId: string,
  input: UpdateItemInput,
) {
  await ensureSessionUserRecord(user);

  const validatedItemId = itemIdParamSchema.parse(itemId);
  const validatedInput = updateItemSchema.parse(input);
  const existingItem = await findItemByIdForUser(validatedItemId, user.id);

  if (!existingItem) {
    throw new AppError('找不到這個項目', 404, 'ITEM_NOT_FOUND');
  }

  const nextScaleMin =
    validatedInput.scaleMin === undefined
      ? existingItem.scaleMin
      : validatedInput.scaleMin;
  const nextScaleMax =
    validatedInput.scaleMax === undefined
      ? existingItem.scaleMax
      : validatedInput.scaleMax;

  assertScaleConfig(
    existingItem.valueType,
    nextScaleMin ?? null,
    nextScaleMax ?? null,
  );

  if (
    validatedInput.version !== undefined &&
    validatedInput.version !== existingItem.version
  ) {
    throw new AppError('項目版本不一致，請重新整理後再試一次', 409, 'ITEM_VERSION_CONFLICT', {
      currentVersion: existingItem.version,
      requestedVersion: validatedInput.version,
    });
  }

  return updateItemRecord(existingItem.id, user.id, {
    title: validatedInput.title ?? existingItem.title,
    unit:
      validatedInput.unit === undefined
        ? existingItem.unit
        : validatedInput.unit,
    archived: validatedInput.archived ?? existingItem.archived,
    sortOrder: validatedInput.sortOrder ?? existingItem.sortOrder,
    scaleMin: nextScaleMin,
    scaleMax: nextScaleMax,
    version: existingItem.version + 1,
  });
}

export async function deleteItemForUser(user: SessionUser, itemId: string) {
  await ensureSessionUserRecord(user);

  const validatedItemId = itemIdParamSchema.parse(itemId);
  const existingItem = await findItemByIdForUser(validatedItemId, user.id);

  if (!existingItem) {
    throw new AppError('找不到這個項目', 404, 'ITEM_NOT_FOUND');
  }

  await updateItemRecord(existingItem.id, user.id, {
    deletedAt: new Date(),
    version: existingItem.version + 1,
  });
}
