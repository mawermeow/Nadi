import type { ReactNode } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { LoaderIcon, PencilIcon, TrashIcon } from '@/components/ui/icons';
import type { RecordResponse } from '@/features/records/api';
import { getSyncStatusPresentation } from '@/features/sync/local-ui';

type RecordCardProps = {
  record: RecordResponse;
  compact?: boolean;
  isDeleting?: boolean;
  onEdit?: (record: RecordResponse) => void;
  onDelete?: (recordId: string) => void;
};

function getItemTypeBadgeClass(type: 'metric' | 'symptom') {
  return type === 'symptom'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-[var(--accent-soft)] text-[var(--accent)]';
}

function formatRecordValue(record: RecordResponse) {
  if (record.valueType === 'boolean') {
    return record.value ? '是' : '否';
  }

  if (record.valueType === 'text') {
    return String(record.value);
  }

  return `${record.value}${record.unit ? ` ${record.unit}` : ''}`;
}

function formatRecordedAt(recordedAt: string) {
  const date = new Date(recordedAt);

  return {
    dateLabel: new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date),
    timeLabel: new Intl.DateTimeFormat('zh-TW', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

export function RecordCard({
  record,
  compact = false,
  isDeleting = false,
  onEdit,
  onDelete,
}: RecordCardProps) {
  const syncStatus = getSyncStatusPresentation(record.syncStatus);
  const showActions = !compact && (onEdit || onDelete);
  const { dateLabel, timeLabel } = formatRecordedAt(record.recordedAt);

  return (
    <article className="p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            className={`font-medium text-[var(--muted)] ${compact ? 'text-sm' : 'text-base'}`}
          >
            {record.itemTitle}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getItemTypeBadgeClass(record.itemType)}`}
          >
            {record.itemType === 'metric' ? '指標' : '症狀'}
          </span>
        </div>

        <time
          dateTime={record.recordedAt}
          className="flex gap-2 shrink-0 text-right text-xs leading-5 text-[var(--muted)] tabular-nums sm:text-sm"
        >
          <span className="block">{dateLabel}</span>
          <span className="block">{timeLabel}</span>
        </time>
      </div>

      <div
        className={`mt-2 flex items-start gap-3 ${showActions ? 'justify-between' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`break-words font-semibold leading-snug text-[var(--foreground)] ${compact ? 'text-base' : 'text-lg'}`}
          >
            {formatRecordValue(record)}
          </p>

          {record.note ? (
            <p className="mt-1.5 border-l-2 border-stone-200 pl-2.5 text-sm leading-6 text-[var(--muted)]">
              {record.note}
            </p>
          ) : null}
        </div>

        {showActions ? (
          <div className="flex shrink-0 gap-1.5">
            {onEdit ? (
              <IconButton
                label="編輯"
                icon={<PencilIcon size={18} />}
                onClick={() => onEdit(record)}
              />
            ) : null}
            {onDelete ? (
              <IconButton
                label={isDeleting ? '處理中…' : '刪除'}
                icon={
                  isDeleting ? <LoaderIcon size={18} /> : <TrashIcon size={18} />
                }
                variant="danger"
                disabled={isDeleting}
                onClick={() => onDelete(record.id)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {record.itemArchived || syncStatus ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {record.itemArchived ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              已封存項目
            </span>
          ) : null}
          {syncStatus ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${syncStatus.className}`}
            >
              {syncStatus.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function RecordList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
      {children}
    </div>
  );
}

export function RecordCardSkeleton() {
  return (
    <div className="animate-pulse p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-stone-200" />
          <div className="h-4 w-10 rounded-full bg-stone-100" />
        </div>
        <div className="space-y-1 text-right">
          <div className="ml-auto h-3 w-20 rounded bg-stone-100" />
          <div className="ml-auto h-3 w-14 rounded bg-stone-100" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="pl-3 sm:pl-4">
          <div className="h-5 w-16 rounded bg-stone-100" />
        </div>
        <div className="h-9 w-[4.5rem] rounded-xl bg-stone-100" />
      </div>
    </div>
  );
}
