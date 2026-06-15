import type { Item } from '@/db/schema';

export type ItemResponse = {
  id: string;
  title: string;
  type: 'metric' | 'symptom';
  unit?: string;
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  scaleMin?: number;
  scaleMax?: number;
  archived: boolean;
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
    archived: item.archived,
    createdAt: item.createdAt.toISOString(),
  };
}
