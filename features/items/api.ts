import type { Item } from '@/db/schema';

export type ItemResponse = {
  id: string;
  title: string;
  type: 'metric' | 'symptom';
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number;
  scaleMax?: number;
  sortOrder: number;
  archived: boolean;
  syncStatus?: 'pending' | 'synced' | 'conflict' | 'failed';
  version: number;
  createdAt: string;
};

export function toItemResponse(item: Item): ItemResponse {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit ?? undefined,
    valueType: item.valueType,
    scaleMin: item.scaleMin ?? undefined,
    scaleMax: item.scaleMax ?? undefined,
    sortOrder: item.sortOrder,
    archived: item.archived,
    syncStatus: item.syncStatus,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
  };
}
