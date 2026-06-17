'use client';

import { useState, type ReactNode } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { LoaderIcon, MoreHorizontalIcon, PencilIcon, TrashIcon, XIcon } from '@/components/ui/icons';
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
    if (record.itemType === 'symptom') {
      return null;
    }

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
  const [actionsRevealed, setActionsRevealed] = useState(false);
  const syncStatus = getSyncStatusPresentation(record.syncStatus);
  const showActions = !compact && (onEdit || onDelete);
  const { dateLabel, timeLabel } = formatRecordedAt(record.recordedAt);
  const formattedValue = formatRecordValue(record);
  const titleClassName = compact
    ? 'text-base font-semibold text-[var(--foreground)] sm:text-lg'
    : 'text-lg font-semibold text-[var(--foreground)] sm:text-xl';
  const valueClassName = compact
    ? 'text-base font-semibold leading-snug text-[var(--foreground)] sm:text-lg'
    : 'text-lg font-semibold leading-snug text-[var(--foreground)] sm:text-xl';

  const shiftableClassName = [
    'min-w-0 transition-[padding,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
    showActions
      ? actionsRevealed
        ? 'pr-[9.75rem] opacity-45 sm:pr-[10.75rem]'
        : 'pr-14 opacity-100'
      : '',
    actionsRevealed ? '-translate-x-0.5' : 'translate-x-0',
  ]
    .filter(Boolean)
    .join(' ');
  const titleLayerClassName = [
    'flex max-w-[calc(100%-10rem)] flex-wrap items-center gap-2',
    'transition-opacity duration-200 ease-out motion-reduce:transition-none',
    showActions
      ? 'pointer-events-none absolute top-3.5 left-3.5 z-10 sm:top-4 sm:left-4'
      : '',
    showActions && actionsRevealed ? 'opacity-45' : 'opacity-100',
  ]
    .filter(Boolean)
    .join(' ');

  const titleAndBadge = (
    <>
      <h3 className={titleClassName}>{record.itemTitle}</h3>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getItemTypeBadgeClass(record.itemType)}`}
      >
        {record.itemType === 'metric' ? '指標' : '症狀'}
      </span>
    </>
  );

  return (
    <article className="relative overflow-hidden p-3.5 sm:p-4">
      {showActions ? (
        <div className={titleLayerClassName}>{titleAndBadge}</div>
      ) : null}

      <div className={shiftableClassName}>
        <div className="flex items-start justify-between gap-3">
          {showActions ? (
            <div
              className="h-7 min-w-0 flex-1 sm:h-8"
              aria-hidden
            />
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {titleAndBadge}
            </div>
          )}

          <time
            dateTime={record.recordedAt}
            className="flex shrink-0 gap-[6px] text-right text-xs leading-5 text-[var(--muted)] tabular-nums sm:text-sm"
          >
            <span className="block">{dateLabel}</span>
            <span className="block">{timeLabel}</span>
          </time>
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

        {record.note || formattedValue ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
            {record.note ? (
              <p className="min-w-0 max-w-full flex-1 border-l-2 border-stone-200 pl-2.5 text-sm leading-6 break-words text-[var(--muted)]">
                {record.note}
              </p>
            ) : null}
            {formattedValue ? (
              <p
                className={[
                  'max-w-full text-right break-words',
                  record.note ? 'shrink-0' : 'ml-auto w-full',
                  valueClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {formattedValue}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {showActions ? (
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-white from-35% via-white/90 to-transparent sm:w-44',
            'transition-opacity duration-200 ease-out motion-reduce:transition-none',
            actionsRevealed ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
      ) : null}

      {showActions ? (
        <aside
          aria-label="紀錄操作"
          className="absolute top-1/2 right-3.5 z-20 -translate-y-1/2 sm:right-4"
        >
          <div className="relative min-h-11">
            <div
              className={[
                'flex items-center gap-1.5 transition-opacity duration-200 ease-out motion-reduce:transition-none',
                actionsRevealed
                  ? 'opacity-100'
                  : 'pointer-events-none absolute top-0 right-0 opacity-0',
              ].join(' ')}
            >
              {onEdit ? (
                <IconButton
                  label="編輯"
                  icon={<PencilIcon size={18} />}
                  onClick={() => onEdit(record)}
                  tabIndex={actionsRevealed ? undefined : -1}
                />
              ) : null}
              {onDelete ? (
                <IconButton
                  label={isDeleting ? '處理中…' : '刪除'}
                  icon={
                    isDeleting ? (
                      <LoaderIcon size={18} />
                    ) : (
                      <TrashIcon size={18} />
                    )
                  }
                  variant="danger"
                  disabled={isDeleting}
                  onClick={() => onDelete(record.id)}
                  tabIndex={actionsRevealed ? undefined : -1}
                />
              ) : null}
              <IconButton
                label="收起操作"
                icon={<XIcon size={18} />}
                onClick={() => setActionsRevealed(false)}
                tabIndex={actionsRevealed ? undefined : -1}
              />
            </div>
            <IconButton
              label="更多操作"
              icon={<MoreHorizontalIcon size={18} />}
              onClick={() => setActionsRevealed(true)}
              className={[
                'text-[var(--muted)] transition-opacity duration-200 ease-out motion-reduce:transition-none',
                actionsRevealed
                  ? 'pointer-events-none absolute top-0 right-0 opacity-0'
                  : 'opacity-100',
              ].join(' ')}
              tabIndex={actionsRevealed ? -1 : undefined}
            />
          </div>
        </aside>
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
    <div className="relative animate-pulse overflow-hidden p-3.5 sm:p-4">
      <div className="pr-14">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-28 rounded bg-stone-200 sm:h-6" />
            <div className="h-4 w-10 rounded-full bg-stone-100" />
          </div>
          <div className="space-y-1 text-right">
            <div className="ml-auto h-3 w-20 rounded bg-stone-100" />
            <div className="ml-auto h-3 w-14 rounded bg-stone-100" />
          </div>
        </div>
        <div className="mt-3 ml-auto h-6 w-16 rounded bg-stone-100 sm:h-7 sm:w-20" />
      </div>
      <div className="absolute top-1/2 right-3.5 -translate-y-1/2 sm:right-4">
        <div className="h-11 w-11 rounded-2xl bg-stone-100" />
      </div>
    </div>
  );
}
