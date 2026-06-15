import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const itemTypeEnum = pgEnum('item_type', ['metric', 'symptom']);
export const itemValueTypeEnum = pgEnum('item_value_type', [
  'number',
  'boolean',
  'scale',
  'text',
]);
export const reportTypeEnum = pgEnum('report_type', [
  'summary',
  'correlation',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    type: itemTypeEnum('type').notNull(),
    unit: text('unit'),
    valueType: itemValueTypeEnum('value_type').notNull(),
    scaleMin: integer('scale_min'),
    scaleMax: integer('scale_max'),
    archived: boolean('archived').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    check('items_title_not_blank_check', sql`char_length(trim(${table.title})) > 0`),
    check(
      'items_scale_config_check',
      sql`(
        (${table.valueType} = 'scale' and ${table.scaleMin} is not null and ${table.scaleMax} is not null and ${table.scaleMin} < ${table.scaleMax})
        or
        (${table.valueType} <> 'scale' and ${table.scaleMin} is null and ${table.scaleMax} is null)
      )`,
    ),
    index('items_user_id_idx').on(table.userId),
    index('items_user_type_idx').on(table.userId, table.type),
    index('items_user_archived_idx').on(table.userId, table.archived),
  ],
);

export const records = pgTable(
  'records',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    valueNumber: doublePrecision('value_number'),
    valueText: text('value_text'),
    valueBoolean: boolean('value_boolean'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    note: text('note'),
    ...timestamps,
  },
  (table) => [
    check(
      'records_single_value_check',
      sql`(
        (case when ${table.valueNumber} is not null then 1 else 0 end) +
        (case when ${table.valueText} is not null then 1 else 0 end) +
        (case when ${table.valueBoolean} is not null then 1 else 0 end)
      ) = 1`,
    ),
    check(
      'records_note_length_check',
      sql`${table.note} is null or char_length(${table.note}) <= 500`,
    ),
    index('records_user_recorded_at_idx').on(table.userId, table.recordedAt),
    index('records_user_item_recorded_at_idx').on(
      table.userId,
      table.itemId,
      table.recordedAt,
    ),
    index('records_item_recorded_at_idx').on(table.itemId, table.recordedAt),
  ],
);

export const reportSnapshots = pgTable(
  'report_snapshots',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    reportType: reportTypeEnum('report_type').notNull(),
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    resultJson: jsonb('result_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('report_snapshots_user_range_idx').on(
      table.userId,
      table.reportType,
      table.fromDate,
      table.toDate,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Record = typeof records.$inferSelect;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
