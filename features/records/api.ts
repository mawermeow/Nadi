export type RecordResponse = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: 'metric' | 'symptom';
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  value: number | boolean | string;
  unit?: string;
  recordedAt: string;
  note?: string;
  itemArchived: boolean;
  createdAt: string;
};
