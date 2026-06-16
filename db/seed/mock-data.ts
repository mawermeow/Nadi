import { items, records } from '@/db/schema';
import { upsertUser } from '@/features/auth/repository';
import { getDb } from '@/lib/db/client';
import { ensureLocalEnvLoaded } from '@/lib/env/load-env';

type SeedItem = typeof items.$inferInsert;
type SeedRecord = typeof records.$inferInsert;

const LOCAL_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'local@nadi.dev',
  name: 'Local Seed User',
  emailVerified: true,
};

function seedUuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}

function createUtcDate(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

const seedItems: SeedItem[] = [
  {
    id: seedUuid(1),
    userId: LOCAL_USER.id,
    title: '睡眠時數',
    type: 'metric',
    unit: '小時',
    valueType: 'number',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(2),
    userId: LOCAL_USER.id,
    title: '飲水量',
    type: 'metric',
    unit: '公升',
    valueType: 'number',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(3),
    userId: LOCAL_USER.id,
    title: '咖啡',
    type: 'metric',
    unit: null,
    valueType: 'boolean',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(4),
    userId: LOCAL_USER.id,
    title: '步行',
    type: 'metric',
    unit: '步',
    valueType: 'number',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(5),
    userId: LOCAL_USER.id,
    title: '備註心情',
    type: 'metric',
    unit: null,
    valueType: 'text',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(6),
    userId: LOCAL_USER.id,
    title: '頭痛程度',
    type: 'symptom',
    unit: null,
    valueType: 'scale',
    scaleMin: 0,
    scaleMax: 10,
    archived: false,
  },
  {
    id: seedUuid(7),
    userId: LOCAL_USER.id,
    title: '疲勞感',
    type: 'symptom',
    unit: null,
    valueType: 'boolean',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(8),
    userId: LOCAL_USER.id,
    title: '腸胃不適描述',
    type: 'symptom',
    unit: null,
    valueType: 'text',
    scaleMin: null,
    scaleMax: null,
    archived: false,
  },
  {
    id: seedUuid(9),
    userId: LOCAL_USER.id,
    title: '舊版壓力量表',
    type: 'metric',
    unit: null,
    valueType: 'scale',
    scaleMin: 1,
    scaleMax: 5,
    archived: true,
  },
];

function buildSeedRecords() {
  const seedRecords: SeedRecord[] = [];
  let recordSequence = 1000;

  for (let dayIndex = 0; dayIndex < 21; dayIndex += 1) {
    const offset = dayIndex - 20;
    const sleepHours =
      dayIndex % 6 === 0 ? 5 :
      dayIndex % 5 === 0 ? 5.5 :
      dayIndex % 3 === 0 ? 6 :
      7.5;
    const waterLiters = dayIndex % 4 === 0 ? 1.4 : 2.1;
    const caffeine = dayIndex % 2 === 0;
    const steps = dayIndex % 7 === 0 ? 4200 : 7800;
    const moodText = dayIndex % 5 === 0 ? '節奏偏滿，晚上想早點休息。' : '日常狀態大致平穩。';
    const headacheSeverity =
      dayIndex % 6 === 0 ? 7 :
      dayIndex % 5 === 0 ? 5 :
      0;
    const fatigue =
      dayIndex % 6 === 0 || dayIndex % 5 === 0 || dayIndex % 3 === 0;

    seedRecords.push(
      {
        id: seedUuid(recordSequence),
        userId: LOCAL_USER.id,
        itemId: seedUuid(1),
        valueNumber: sleepHours,
        valueText: null,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 7, 30),
        note: dayIndex % 6 === 0 ? '前一晚睡得比較少。' : null,
      },
      {
        id: seedUuid(recordSequence + 1),
        userId: LOCAL_USER.id,
        itemId: seedUuid(2),
        valueNumber: waterLiters,
        valueText: null,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 20, 0),
        note: null,
      },
      {
        id: seedUuid(recordSequence + 2),
        userId: LOCAL_USER.id,
        itemId: seedUuid(3),
        valueNumber: null,
        valueText: null,
        valueBoolean: caffeine,
        recordedAt: createUtcDate(offset, 8, 0),
        note: caffeine ? '早上有喝一杯。' : null,
      },
      {
        id: seedUuid(recordSequence + 3),
        userId: LOCAL_USER.id,
        itemId: seedUuid(4),
        valueNumber: steps,
        valueText: null,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 19, 0),
        note: null,
      },
      {
        id: seedUuid(recordSequence + 4),
        userId: LOCAL_USER.id,
        itemId: seedUuid(5),
        valueNumber: null,
        valueText: moodText,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 22, 0),
        note: null,
      },
      {
        id: seedUuid(recordSequence + 5),
        userId: LOCAL_USER.id,
        itemId: seedUuid(7),
        valueNumber: null,
        valueText: null,
        valueBoolean: fatigue,
        recordedAt: createUtcDate(offset, 21, 30),
        note: fatigue ? '傍晚開始有點沒精神。' : null,
      },
    );

    if (headacheSeverity > 0) {
      seedRecords.push({
        id: seedUuid(recordSequence + 6),
        userId: LOCAL_USER.id,
        itemId: seedUuid(6),
        valueNumber: headacheSeverity,
        valueText: null,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 12, 0),
        note:
          headacheSeverity >= 7
            ? '中午前後開始明顯不舒服。'
            : '有點悶痛，但還能工作。',
      });
    }

    if (dayIndex % 7 === 2 || dayIndex % 9 === 0) {
      seedRecords.push({
        id: seedUuid(recordSequence + 7),
        userId: LOCAL_USER.id,
        itemId: seedUuid(8),
        valueNumber: null,
        valueText: '下午後段有些脹氣感。',
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 16, 30),
        note: null,
      });
    }

    if (dayIndex < 5) {
      seedRecords.push({
        id: seedUuid(recordSequence + 8),
        userId: LOCAL_USER.id,
        itemId: seedUuid(9),
        valueNumber: (dayIndex % 5) + 1,
        valueText: null,
        valueBoolean: null,
        recordedAt: createUtcDate(offset, 18, 0),
        note: '保留給 archived item flow 測試。',
      });
    }

    recordSequence += 10;
  }

  return seedRecords;
}

async function main() {
  ensureLocalEnvLoaded();
  const db = getDb();
  const seedRecords = buildSeedRecords();

  await upsertUser(LOCAL_USER);

  for (const item of seedItems) {
    await db
      .insert(items)
      .values(item)
      .onConflictDoUpdate({
        target: items.id,
        set: {
          title: item.title,
          type: item.type,
          unit: item.unit,
          valueType: item.valueType,
          scaleMin: item.scaleMin,
          scaleMax: item.scaleMax,
          archived: item.archived,
          updatedAt: new Date(),
        },
      });
  }

  for (const record of seedRecords) {
    await db
      .insert(records)
      .values(record)
      .onConflictDoUpdate({
        target: records.id,
        set: {
          itemId: record.itemId,
          valueNumber: record.valueNumber,
          valueText: record.valueText,
          valueBoolean: record.valueBoolean,
          recordedAt: record.recordedAt,
          note: record.note,
          updatedAt: new Date(),
        },
      });
  }

  console.log(
    `Seed 完成：建立或更新 ${seedItems.length} 個項目、${seedRecords.length} 筆 mock records。`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
