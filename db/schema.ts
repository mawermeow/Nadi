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
export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'synced',
  'conflict',
  'failed',
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
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name').notNull().default(''),
    image: text('image'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_idx').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('accounts_provider_account_idx').on(
      table.providerId,
      table.accountId,
    ),
    index('accounts_user_id_idx').on(table.userId),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('verifications_identifier_idx').on(table.identifier),
    index('verifications_expires_at_idx').on(table.expiresAt),
  ],
);

export const deviceAccountLinks = pgTable(
  'device_account_links',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMergedAt: timestamp('last_merged_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('device_account_links_device_id_idx').on(table.deviceId),
    index('device_account_links_user_id_idx').on(table.userId),
    index('device_account_links_last_seen_at_idx').on(table.lastSeenAt),
  ],
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
    syncStatus: syncStatusEnum('sync_status').notNull().default('synced'),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    deviceId: text('device_id'),
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
    index('items_user_sync_status_idx').on(table.userId, table.syncStatus),
    index('items_user_updated_at_idx').on(table.userId, table.updatedAt),
    index('items_user_deleted_at_idx').on(table.userId, table.deletedAt),
    index('items_user_device_id_idx').on(table.userId, table.deviceId),
    index('items_user_version_idx').on(table.userId, table.version),
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
    syncStatus: syncStatusEnum('sync_status').notNull().default('synced'),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    deviceId: text('device_id'),
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
    index('records_user_sync_status_idx').on(table.userId, table.syncStatus),
    index('records_user_updated_at_idx').on(table.userId, table.updatedAt),
    index('records_user_deleted_at_idx').on(table.userId, table.deletedAt),
    index('records_user_device_id_idx').on(table.userId, table.deviceId),
    index('records_user_version_idx').on(table.userId, table.version),
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
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type DeviceAccountLink = typeof deviceAccountLinks.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Record = typeof records.$inferSelect;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
