'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { AppShell } from '@/features/records/components/app-shell';
import { CreateEntryView } from '@/features/records/components/create-entry-view';
import { DashboardView } from '@/features/records/components/dashboard-view';
import { RecordsListView } from '@/features/records/components/records-list-view';
import { ReportsView } from '@/features/records/components/reports-view';
import { SettingsView } from '@/features/records/components/settings-view';
import type { ItemResponse } from '@/features/items/api';
import type { RecordResponse } from '@/features/records/api';
import type {
  CorrelationReportResponse,
  SummaryReportResponse,
} from '@/features/reports/api';
import { CorrelationReportSection } from '@/features/reports/components/correlation-report-section';
import { SummaryReportSection } from '@/features/reports/components/summary-report-section';
import {
  createLocalItem,
  createLocalRecord,
  deleteLocalRecord,
  updateLocalItem,
  updateLocalRecord,
} from '@/features/sync/local-service';
import {
  getSyncStatusPresentation,
  hydrateLocalStoreFromServerSnapshot,
  loadLocalItems,
  loadLocalRecords,
  mapLocalItemToItemResponse,
  mapLocalRecordToRecordResponse,
} from '@/features/sync/local-ui';
import { startForegroundSync, runSync } from '@/features/sync/client-service';
import { getSyncState, subscribeSyncState, type SyncState } from '@/features/sync/state';
import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';

type RecordDashboardProps = {
  initialItems: ItemResponse[];
  initialRecords: RecordResponse[];
  initialSummaryReport: SummaryReportResponse;
  initialCorrelationReport: CorrelationReportResponse;
  maxReportRangeDays: number;
  defaultCorrelationWindowHours: number;
  userEmail: string;
};

type ItemFormState = {
  title: string;
  type: 'metric' | 'symptom';
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  unit: string;
  scaleMin: string;
  scaleMax: string;
};

type RecordFormState = {
  itemId: string;
  valueText: string;
  valueBoolean: 'true' | 'false';
  recordedAt: string;
  note: string;
};

type FilterState = {
  itemType: 'metric' | 'symptom';
  itemId: string;
  from: string;
  to: string;
};

type ApiFieldErrors = Record<string, string[] | undefined>;

const defaultItemFormState: ItemFormState = {
  title: '',
  type: 'metric',
  valueType: 'number',
  unit: '',
  scaleMin: '',
  scaleMax: '',
};

const appTabs = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: '首頁', icon: '⌂' },
  { id: 'create', label: '新增紀錄', mobileLabel: '新增', icon: '+' },
  { id: 'records', label: '紀錄列表', mobileLabel: '紀錄', icon: '≣' },
  { id: 'reports', label: '報表', mobileLabel: '報表', icon: '◔' },
  { id: 'settings', label: '設定', mobileLabel: '設定', icon: '⚙' },
] as const;

const itemTypeOptions = [
  { value: 'metric', label: '指標' },
  { value: 'symptom', label: '症狀' },
] as const;

const valueTypeOptions = [
  { value: 'number', label: '數字' },
  { value: 'boolean', label: '是 / 否' },
  { value: 'scale', label: '量表' },
  { value: 'text', label: '文字' },
] as const;

function getValueTypeLabel(valueType: ItemFormState['valueType']) {
  return (
    valueTypeOptions.find((option) => option.value === valueType)?.label ??
    valueType
  );
}

function getItemTypeTabClass(
  currentValue: 'metric' | 'symptom',
  optionValue: 'metric' | 'symptom',
) {
  if (currentValue !== optionValue) {
    return 'border-[var(--line)] bg-white text-[var(--foreground)]';
  }

  return optionValue === 'symptom'
    ? 'border-rose-400 bg-rose-500 text-white'
    : 'border-[var(--accent)] bg-[var(--accent)] text-white';
}

function getItemTypeBadgeClass(type: 'metric' | 'symptom') {
  return type === 'symptom'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-[var(--accent-soft)] text-[var(--accent)]';
}

function getRecordCardClass(type: 'metric' | 'symptom') {
  return type === 'symptom'
    ? 'border-rose-200 bg-rose-50/40'
    : 'border-[var(--line)] bg-white';
}

function getRecordValueClass(type: 'metric' | 'symptom') {
  return type === 'symptom'
    ? 'bg-rose-100/80 text-rose-800'
    : 'bg-[var(--accent-soft)] text-[var(--accent)]';
}

function formatDateTimeLocal(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

function dateInputToRange(value: string, edge: 'start' | 'end') {
  if (!value) {
    return undefined;
  }

  const suffix = edge === 'start' ? 'T00:00' : 'T23:59:59.999';
  return new Date(`${value}${suffix}`).toISOString();
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

function getSummaryViewTitle(tabId: (typeof appTabs)[number]['id']) {
  switch (tabId) {
    case 'dashboard':
      return 'Dashboard';
    case 'create':
      return '新增紀錄';
    case 'records':
      return '紀錄列表';
    case 'reports':
      return '報表';
    case 'settings':
      return '設定';
  }
}

function formatSyncTimestamp(value: string | null) {
  if (!value) {
    return '尚未同步';
  }

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function RecordDashboard({
  initialItems,
  initialRecords,
  initialSummaryReport,
  initialCorrelationReport,
  maxReportRangeDays,
  defaultCorrelationWindowHours,
  userEmail,
}: RecordDashboardProps) {
  const initialRecordItemType =
    initialItems.find((item) => !item.archived)?.type ?? 'metric';
  const [activeTab, setActiveTab] = useState<(typeof appTabs)[number]['id']>(
    'dashboard',
  );
  const [items, setItems] = useState(initialItems);
  const [records, setRecords] = useState(initialRecords);
  const [showArchived, setShowArchived] = useState(false);
  const [recordItemTypeTab, setRecordItemTypeTab] = useState<
    'metric' | 'symptom'
  >(initialRecordItemType);
  const [itemFormState, setItemFormState] = useState(defaultItemFormState);
  const [recordFormState, setRecordFormState] = useState<RecordFormState>({
    itemId: initialItems.find((item) => !item.archived)?.id ?? '',
    valueText: '',
    valueBoolean: 'true',
    recordedAt: formatDateTimeLocal(),
    note: '',
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    itemType: initialRecordItemType,
    itemId: '',
    from: '',
    to: '',
  });
  const [itemFieldErrors, setItemFieldErrors] = useState<ApiFieldErrors>({});
  const [recordFieldErrors, setRecordFieldErrors] = useState<ApiFieldErrors>({});
  const [itemError, setItemError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [itemNotice, setItemNotice] = useState<string | null>(null);
  const [recordNotice, setRecordNotice] = useState<string | null>(null);
  const [isSubmittingItem, startItemTransition] = useTransition();
  const [isSubmittingRecord, startRecordTransition] = useTransition();
  const [isLoadingTimeline, startTimelineTransition] = useTransition();
  const [isMutatingItem, startItemMutationTransition] = useTransition();
  const [isDeletingRecord, startDeleteTransition] = useTransition();
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [isHydratingLocal, setIsHydratingLocal] = useState(true);

  const activeItems = useMemo(
    () => items.filter((item) => !item.archived),
    [items],
  );
  const selectableRecordItems = useMemo(
    () => activeItems.filter((item) => item.type === recordItemTypeTab),
    [activeItems, recordItemTypeTab],
  );
  const archivedItems = useMemo(
    () => items.filter((item) => item.archived),
    [items],
  );
  const symptomItems = useMemo(
    () => items.filter((item) => item.type === 'symptom'),
    [items],
  );
  const timelineSelectableItems = useMemo(
    () => items.filter((item) => item.type === filterState.itemType),
    [filterState.itemType, items],
  );
  const selectedItem = useMemo(
    () =>
      selectableRecordItems.find((item) => item.id === recordFormState.itemId) ??
      null,
    [recordFormState.itemId, selectableRecordItems],
  );
  const syncStatusCard = useMemo(() => {
    const statusLabel = {
      idle: '已就緒',
      syncing: '同步中',
      offline: '離線',
      error: '同步錯誤',
      conflict: '有同步衝突',
    }[syncState.status];

    return {
      statusLabel,
      lastSyncAt: formatSyncTimestamp(syncState.lastSyncAt),
    };
  }, [syncState.lastSyncAt, syncState.status]);

  const loadLocalData = useCallback(
    async (options?: {
      preserveCurrentFilter?: boolean;
    }) => {
      const [nextItems, nextRecords] = await Promise.all([
        loadLocalItems(),
        loadLocalRecords({
          itemId: options?.preserveCurrentFilter ? filterState.itemId || undefined : undefined,
          itemType: options?.preserveCurrentFilter ? filterState.itemType : undefined,
          from:
            options?.preserveCurrentFilter && filterState.from
              ? dateInputToRange(filterState.from, 'start')
              : undefined,
          to:
            options?.preserveCurrentFilter && filterState.to
              ? dateInputToRange(filterState.to, 'end')
              : undefined,
          limit:
            options?.preserveCurrentFilter &&
            (filterState.itemId || filterState.from || filterState.to)
              ? 100
              : 20,
        }),
      ]);

      setItems(nextItems);
      setRecords(nextRecords);

      setRecordFormState((currentState) => {
        const nextItemExists = nextItems.some(
          (item) => item.id === currentState.itemId && !item.archived,
        );

        if (nextItemExists) {
          return currentState;
        }

        const nextDefaultItem =
          nextItems.find(
            (item) => !item.archived && item.type === recordItemTypeTab,
          ) ?? nextItems.find((item) => !item.archived);

        return {
          ...currentState,
          itemId: nextDefaultItem?.id ?? '',
        };
      });
    },
    [filterState.from, filterState.itemId, filterState.itemType, filterState.to, recordItemTypeTab],
  );

  function navigateToTab(tabId: string) {
    const nextTab = appTabs.find((tab) => tab.id === tabId)?.id;

    if (!nextTab) {
      return;
    }

    setActiveTab(nextTab);
  }

  function updateItemFormValue<Key extends keyof ItemFormState>(
    key: Key,
    value: ItemFormState[Key],
  ) {
    setItemFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  function updateRecordFormValue<Key extends keyof RecordFormState>(
    key: Key,
    value: RecordFormState[Key],
  ) {
    setRecordFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  function updateFilterValue<Key extends keyof FilterState>(
    key: Key,
    value: FilterState[Key],
  ) {
    setFilterState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  function updateRecordItemTypeTab(nextType: 'metric' | 'symptom') {
    const nextSelectableItem = activeItems.find((item) => item.type === nextType);

    setRecordItemTypeTab(nextType);
    setRecordFormState((currentState) => ({
      ...currentState,
      itemId: nextSelectableItem?.id ?? '',
    }));
  }

  function updateTimelineItemTypeTab(nextType: 'metric' | 'symptom') {
    setFilterState((currentState) => ({
      ...currentState,
      itemType: nextType,
      itemId: '',
    }));
  }

  function populateRecordFormForEdit(record: RecordResponse) {
    const recordItem = items.find((item) => item.id === record.itemId);

    setEditingRecordId(record.id);
    setRecordItemTypeTab(record.itemType);
    setRecordFormState({
      itemId: record.itemId,
      valueText:
        typeof record.value === 'string' || typeof record.value === 'number'
          ? String(record.value)
          : '',
      valueBoolean: typeof record.value === 'boolean' && !record.value ? 'false' : 'true',
      recordedAt: formatDateTimeLocal(new Date(record.recordedAt)),
      note: record.note ?? '',
    });
    setRecordNotice(
      recordItem
        ? `正在編輯「${recordItem.title}」的紀錄。`
        : '正在編輯這筆紀錄。',
    );
    setActiveTab('create');
  }

  function resetRecordForm() {
    setEditingRecordId(null);
    setRecordFormState((currentState) => ({
      ...currentState,
      valueText: '',
      valueBoolean: 'true',
      note: '',
      recordedAt: formatDateTimeLocal(),
    }));
  }

  useEffect(() => {
    let isMounted = true;
    let stopForegroundSync: () => void = () => {};

    async function initializeLocalFirstUi() {
      await hydrateLocalStoreFromServerSnapshot({
        items: initialItems,
        records: initialRecords,
      });

      if (!isMounted) {
        return;
      }

      await loadLocalData();

      if (!isMounted) {
        return;
      }

      setIsHydratingLocal(false);
      stopForegroundSync = startForegroundSync();

      try {
        await runSync();
      } catch {
        // Sync state already captures foreground sync failures.
      }
    }

    void initializeLocalFirstUi();

    const unsubscribe = subscribeSyncState((nextState) => {
      setSyncState(nextState);

      if (nextState.lastSyncAt) {
        void loadLocalData({
          preserveCurrentFilter: true,
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      stopForegroundSync();
    };
  }, [initialItems, initialRecords, loadLocalData]);

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItemError(null);
    setItemNotice(null);
    setItemFieldErrors({});

    const payload = {
      title: itemFormState.title,
      type: itemFormState.type,
      valueType: itemFormState.valueType,
      unit: itemFormState.unit,
      scaleMin:
        itemFormState.valueType === 'scale' ? itemFormState.scaleMin : undefined,
      scaleMax:
        itemFormState.valueType === 'scale' ? itemFormState.scaleMax : undefined,
    };

    startItemTransition(async () => {
      try {
        const createdItem = await createLocalItem({
          title: payload.title,
          type: payload.type,
          valueType: payload.valueType,
          unit: payload.unit || null,
          scaleMin:
            payload.scaleMin !== undefined && payload.scaleMin !== ''
              ? Number(payload.scaleMin)
              : null,
          scaleMax:
            payload.scaleMax !== undefined && payload.scaleMax !== ''
              ? Number(payload.scaleMax)
              : null,
        });
        const data = mapLocalItemToItemResponse(createdItem);

        setItems((currentItems) => [data, ...currentItems]);
        setItemFormState(defaultItemFormState);
        setRecordItemTypeTab(data.type);
        setRecordFormState((currentState) => ({
          ...currentState,
          itemId: data.id,
        }));
        setItemNotice(`已建立「${data.title}」，現在可以直接用它來新增紀錄。`);
        await loadLocalData();
        void runSync().catch(() => undefined);
      } catch (error) {
        setItemError(error instanceof Error ? error.message : '建立項目失敗');
        setItemFieldErrors({});
        return;
      }
    });
  }

  async function handleCreateRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecordError(null);
    setRecordNotice(null);
    setRecordFieldErrors({});

    if (!selectedItem) {
      setRecordError('請先建立至少一個啟用中的項目');
      return;
    }

    let value: boolean | number | string = recordFormState.valueText;

    if (selectedItem.valueType === 'boolean') {
      value = recordFormState.valueBoolean === 'true';
    } else if (
      selectedItem.valueType === 'number' ||
      selectedItem.valueType === 'scale'
    ) {
      value = Number(recordFormState.valueText);
    }

    startRecordTransition(async () => {
      try {
        if (editingRecordId) {
          const updatedRecord = await updateLocalRecord({
            id: editingRecordId,
            itemId: selectedItem.id,
            value,
            recordedAt: localInputToIso(recordFormState.recordedAt),
            note: recordFormState.note || null,
          });
          const localItem = await itemLocalRepository.getById(updatedRecord.itemId);

          if (!localItem) {
            throw new Error('找不到對應的本機項目');
          }

          const data = mapLocalRecordToRecordResponse(updatedRecord, localItem);
          setRecords((currentRecords) =>
            currentRecords.map((currentRecord) =>
              currentRecord.id === data.id ? data : currentRecord,
            ),
          );
          resetRecordForm();
          setRecordNotice(`已更新「${data.itemTitle}」的紀錄。`);
          await loadLocalData({
            preserveCurrentFilter: true,
          });
          void runSync().catch(() => undefined);
          return;
        }

        const createdRecord = await createLocalRecord({
          itemId: selectedItem.id,
          value,
          recordedAt: localInputToIso(recordFormState.recordedAt),
          note: recordFormState.note || null,
        });
        const localItem = await itemLocalRepository.getById(createdRecord.itemId);

        if (!localItem) {
          throw new Error('找不到對應的本機項目');
        }

        const data = mapLocalRecordToRecordResponse(createdRecord, localItem);
        setRecords((currentRecords) => [data, ...currentRecords].slice(0, 20));
        resetRecordForm();
        setRecordNotice(`已記下「${data.itemTitle}」，你可以繼續補下一筆。`);
        await loadLocalData();
        void runSync().catch(() => undefined);
      } catch (error) {
        setRecordError(error instanceof Error ? error.message : '建立紀錄失敗');
        setRecordFieldErrors({});
      }
    });
  }

  async function toggleArchive(item: ItemResponse, archived: boolean) {
    setItemError(null);
    setItemNotice(null);

    startItemMutationTransition(async () => {
      try {
        const updatedItem = await updateLocalItem({
          id: item.id,
          archived,
        });
        const data = mapLocalItemToItemResponse(updatedItem);

        setItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id ? data : currentItem,
          ),
        );

        if (archived && recordFormState.itemId === item.id) {
          const nextItem = activeItems.find((currentItem) => currentItem.id !== item.id);
          setRecordFormState((currentState) => ({
            ...currentState,
            itemId: nextItem?.id ?? '',
          }));
        }

        setItemNotice(
          archived
            ? `已封存「${item.title}」，它不會再出現在預設選單中。`
            : `已恢復「${item.title}」，現在可以再次使用。`,
        );
        await loadLocalData();
        void runSync().catch(() => undefined);
      } catch (error) {
        setItemError(error instanceof Error ? error.message : '更新項目失敗');
        return;
      }
    });
  }

  async function fetchTimeline() {
    setTimelineError(null);
    setRecordNotice(null);

    startTimelineTransition(async () => {
      try {
        const nextRecords = await loadLocalRecords({
          itemId: filterState.itemId || undefined,
          itemType: filterState.itemType,
          from: dateInputToRange(filterState.from, 'start'),
          to: dateInputToRange(filterState.to, 'end'),
          limit: 100,
        });
        setRecords(nextRecords);
      } catch (error) {
        setTimelineError(error instanceof Error ? error.message : '讀取紀錄失敗');
        return;
      }
    });
  }

  async function deleteRecord(recordId: string) {
    setTimelineError(null);
    setRecordNotice(null);

    startDeleteTransition(async () => {
      try {
        await deleteLocalRecord(recordId);
        setRecords((currentRecords) =>
          currentRecords.filter((record) => record.id !== recordId),
        );
        setRecordNotice('已刪除這筆紀錄。');
        await loadLocalData({
          preserveCurrentFilter: true,
        });
        void runSync().catch(() => undefined);
      } catch (error) {
        setTimelineError(error instanceof Error ? error.message : '刪除紀錄失敗');
        return;
      }
    });
  }

  function renderRecords(recordsToRender: RecordResponse[], compact = false) {
    return (
      <div className="grid gap-3">
        {recordsToRender.map((record) => (
          <article
            key={record.id}
            className={`rounded-2xl border p-4 ${getRecordCardClass(record.itemType)}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold`}>
                    {record.itemTitle}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getItemTypeBadgeClass(record.itemType)}`}
                  >
                    {record.itemType === 'metric' ? '指標' : '症狀'}
                  </span>
                  {record.itemArchived ? (
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                      已封存項目
                    </span>
                  ) : null}
                  {getSyncStatusPresentation(record.syncStatus) ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSyncStatusPresentation(record.syncStatus)?.className}`}
                    >
                      {getSyncStatusPresentation(record.syncStatus)?.label}
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-3 inline-flex rounded-2xl px-3 py-2 ${compact ? 'text-base' : 'text-lg'} font-medium ${getRecordValueClass(record.itemType)}`}
                >
                  {formatRecordValue(record)}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {new Intl.DateTimeFormat('zh-TW', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(record.recordedAt))}
                </p>
                {record.note ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {record.note}
                  </p>
                ) : null}
              </div>
              {!compact ? (
                <div className="flex gap-2 sm:self-start">
                  <button
                    type="button"
                    onClick={() => populateRecordFormForEdit(record)}
                    className="min-h-11 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRecord(record.id)}
                    disabled={isDeletingRecord}
                    className="min-h-11 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium"
                  >
                    {isDeletingRecord ? '處理中…' : '刪除'}
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  const pageHeader = activeTab === 'dashboard'
    ? null
    : (
        <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_24px_80px_rgba(31,42,42,0.08)] sm:p-6 lg:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Nadi / {getSummaryViewTitle(activeTab)}
          </p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="max-w-[12ch] text-[2rem] leading-[1.05] font-semibold tracking-tight sm:max-w-none sm:text-[2.5rem]">
                {getSummaryViewTitle(activeTab)}
              </h2>
            </div>
            <div className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)] sm:w-auto">
              目前使用者：{userEmail}
            </div>
          </div>
        </section>
      );

  const syncStatusPanel = (
    <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/88 px-4 py-3 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-[var(--foreground)]">
          同步狀態：{syncStatusCard.statusLabel}
        </span>
        <span className="text-[var(--muted)]">
          pending {syncState.pendingCount}
        </span>
        <span className="text-[var(--muted)]">
          failed {syncState.failedCount}
        </span>
        <span className="text-[var(--muted)]">
          conflict {syncState.conflictCount}
        </span>
        <span className="text-[var(--muted)]">
          上次同步：{syncStatusCard.lastSyncAt}
        </span>
      </div>
    </section>
  );

  const recordForm = (
    <form
      onSubmit={handleCreateRecord}
      className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">
          {editingRecordId ? '編輯紀錄' : '新增紀錄'}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          先選項目、再填一個值即可。若只是快速補記，備註可以先留空。
        </p>
      </div>

      {activeItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          目前還沒有可用項目，因此還不能新增紀錄。下一步：在下方先建立至少一個指標或症狀項目。
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm font-medium">紀錄類型</span>
            <div className="grid grid-cols-2 gap-2">
              {itemTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateRecordItemTypeTab(option.value)}
                  className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(recordItemTypeTab, option.value)}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">選擇項目</span>
            {selectableRecordItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                目前沒有可用的{recordItemTypeTab === 'metric' ? '指標' : '症狀'}項目。下一步：在下方新增一個
                {recordItemTypeTab === 'metric' ? '指標' : '症狀'}項目。
              </div>
            ) : (
              <select
                value={recordFormState.itemId}
                onChange={(event) => updateRecordFormValue('itemId', event.target.value)}
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
              >
                {selectableRecordItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.unit ? ` (${item.unit})` : ''}
                  </option>
                ))}
              </select>
            )}
            {recordFieldErrors.itemId?.[0] ? (
              <span className="text-sm text-rose-700">
                {recordFieldErrors.itemId[0]}
              </span>
            ) : null}
          </label>

          {selectedItem ? (
            <>
              <div className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                目前要記錄的是「{selectedItem.title}」。類型：
                {selectedItem.type === 'metric' ? '指標' : '症狀'} / 格式：
                {getValueTypeLabel(selectedItem.valueType)}
                {selectedItem.unit ? ` / 單位：${selectedItem.unit}` : ''}
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium">
                  紀錄值
                  {selectedItem.valueType === 'scale' &&
                  selectedItem.scaleMin !== undefined &&
                  selectedItem.scaleMax !== undefined
                    ? ` (${selectedItem.scaleMin} - ${selectedItem.scaleMax})`
                    : ''}
                </span>
                {selectedItem.valueType === 'boolean' ? (
                  <select
                    value={recordFormState.valueBoolean}
                    onChange={(event) =>
                      updateRecordFormValue(
                        'valueBoolean',
                        event.target.value as 'true' | 'false',
                      )
                    }
                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </select>
                ) : (
                  <input
                    inputMode={selectedItem.valueType === 'text' ? 'text' : 'decimal'}
                    value={recordFormState.valueText}
                    onChange={(event) =>
                      updateRecordFormValue('valueText', event.target.value)
                    }
                    className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                    placeholder={
                      selectedItem.valueType === 'text'
                        ? '輸入你想記下的內容'
                        : selectedItem.valueType === 'scale'
                          ? '例如：3、5、7'
                          : '例如：6.5'
                    }
                  />
                )}
                {recordFieldErrors.value?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {recordFieldErrors.value[0]}
                  </span>
                ) : null}
              </label>
            </>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-medium">紀錄時間</span>
            <input
              type="datetime-local"
              value={recordFormState.recordedAt}
              onChange={(event) => updateRecordFormValue('recordedAt', event.target.value)}
              className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">備註</span>
            <textarea
              value={recordFormState.note}
              onChange={(event) => updateRecordFormValue('note', event.target.value)}
              className="min-h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
              placeholder="可留空，例如：午睡後、晚餐後"
            />
          </label>
        </div>
      )}

      {recordError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {recordError}
        </p>
      ) : null}
      {recordNotice ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {recordNotice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          activeItems.length === 0 ||
          selectableRecordItems.length === 0 ||
          isSubmittingRecord
        }
        className="mt-5 min-h-12 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmittingRecord
          ? editingRecordId
            ? '更新紀錄中…'
            : '儲存紀錄中…'
          : editingRecordId
            ? '更新這筆紀錄'
            : '儲存這筆紀錄'}
      </button>
      {editingRecordId ? (
        <button
          type="button"
          onClick={resetRecordForm}
          className="mt-3 min-h-12 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-medium"
        >
          取消編輯
        </button>
      ) : null}
    </form>
  );

  const itemForm = (
    <form
      onSubmit={handleCreateItem}
      className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">新增項目</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          若還缺少可選項目，可直接在這裡補上。先從最常記錄的那一個開始即可。
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">項目名稱</span>
          <input
            value={itemFormState.title}
            onChange={(event) => updateItemFormValue('title', event.target.value)}
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
            placeholder="例如：睡眠、喝水、頭痛"
          />
          {itemFieldErrors.title?.[0] ? (
            <span className="text-sm text-rose-700">
              {itemFieldErrors.title[0]}
            </span>
          ) : null}
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">項目類型</span>
          <div className="grid grid-cols-2 gap-2">
            {itemTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateItemFormValue('type', option.value)}
                className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(itemFormState.type, option.value)}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium">值的格式</span>
          <select
            value={itemFormState.valueType}
            onChange={(event) =>
              updateItemFormValue(
                'valueType',
                event.target.value as ItemFormState['valueType'],
              )
            }
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
          >
            {valueTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">單位</span>
          <input
            value={itemFormState.unit}
            onChange={(event) => updateItemFormValue('unit', event.target.value)}
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
            placeholder="例如：小時、杯、次"
          />
        </label>

        {itemFormState.valueType === 'scale' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium">量表最小值</span>
              <input
                inputMode="numeric"
                value={itemFormState.scaleMin}
                onChange={(event) => updateItemFormValue('scaleMin', event.target.value)}
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                placeholder="0"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">量表最大值</span>
              <input
                inputMode="numeric"
                value={itemFormState.scaleMax}
                onChange={(event) => updateItemFormValue('scaleMax', event.target.value)}
                className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                placeholder="10"
              />
            </label>
          </div>
        ) : null}
      </div>

      {itemError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {itemError}
        </p>
      ) : null}
      {itemNotice ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {itemNotice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmittingItem}
        className="mt-5 min-h-12 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmittingItem ? '建立項目中…' : '建立新項目'}
      </button>
    </form>
  );

  const recordsListPanel = (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">紀錄列表</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            在這裡查看、篩選與刪除既有紀錄，不再以整頁捲動來找資料。
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-3 text-sm text-[var(--muted)]">
          目前顯示 {records.length} 筆
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="grid gap-2 lg:col-span-3">
          <span className="text-sm font-medium">查詢類型</span>
          <div className="grid grid-cols-2 gap-2">
            {itemTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateTimelineItemTypeTab(option.value)}
                className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(filterState.itemType, option.value)}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-2">
          <span className="text-sm font-medium">項目篩選</span>
          <select
            value={filterState.itemId}
            onChange={(event) => updateFilterValue('itemId', event.target.value)}
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
          >
            <option value="">
              全部{filterState.itemType === 'metric' ? '指標' : '症狀'}
            </option>
            {timelineSelectableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
                {item.archived ? '（已封存）' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">開始日期</span>
          <input
            type="date"
            value={filterState.from}
            onChange={(event) => updateFilterValue('from', event.target.value)}
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">結束日期</span>
          <input
            type="date"
            value={filterState.to}
            onChange={(event) => updateFilterValue('to', event.target.value)}
            className="min-h-12 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={fetchTimeline}
          disabled={isLoadingTimeline}
          className="min-h-12 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLoadingTimeline ? '整理紀錄中…' : '套用條件'}
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterState({
              itemType: initialRecordItemType,
              itemId: '',
              from: '',
              to: '',
            });
            setTimelineError(null);
            void loadLocalData();
          }}
          className="min-h-12 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-medium"
        >
          回到近期列表
        </button>
      </div>

      {timelineError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {timelineError}
        </p>
      ) : null}

      <div className="mt-5">
        {isLoadingTimeline ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`timeline-loading-${index}`}
                className="animate-pulse rounded-2xl border border-[var(--line)] bg-white p-4"
              >
                <div className="h-4 w-28 rounded bg-stone-200" />
                <div className="mt-3 h-10 rounded-2xl bg-stone-100" />
                <div className="mt-3 h-3 w-36 rounded bg-stone-100" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
            目前沒有符合條件的紀錄。你可以調整日期條件，或先到「新增紀錄」補一筆資料。
          </div>
        ) : (
          renderRecords(records)
        )}
      </div>
    </section>
  );

  const settingsPanel = (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-6">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">項目列表</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              預設只顯示啟用中的項目；封存後會保留歷史紀錄，但不再出現在預設選單。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className="min-h-11 rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-medium"
          >
            {showArchived ? '隱藏已封存' : '顯示已封存'}
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {activeItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
              目前還沒有啟用中的項目。你可以先建立一個最常記錄的指標，像是睡眠、喝水或頭痛程度。
            </div>
          ) : (
            activeItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getItemTypeBadgeClass(item.type)}`}
                      >
                        {item.type === 'metric' ? '指標' : '症狀'}
                      </span>
                      {getSyncStatusPresentation(item.syncStatus) ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSyncStatusPresentation(item.syncStatus)?.className}`}
                        >
                          {getSyncStatusPresentation(item.syncStatus)?.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      格式：{getValueTypeLabel(item.valueType)}
                      {item.unit ? ` / 單位：${item.unit}` : ''}
                      {item.valueType === 'scale' &&
                      item.scaleMin !== undefined &&
                      item.scaleMax !== undefined
                        ? ` / 範圍：${item.scaleMin} - ${item.scaleMax}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleArchive(item, true)}
                    disabled={isMutatingItem}
                    className="min-h-11 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--foreground)] sm:self-start"
                  >
                    {isMutatingItem ? '處理中…' : '封存'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
        <h2 className="text-xl font-semibold">已封存項目</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          已封存項目不會出現在預設選單，但歷史紀錄仍可保留與查詢。
        </p>

        {showArchived ? (
          <div className="mt-5 grid gap-3">
            {archivedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
                目前沒有已封存項目。
              </div>
            ) : (
              archivedItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[var(--line)] bg-stone-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {item.type === 'metric' ? '指標' : '症狀'} / {getValueTypeLabel(item.valueType)}
                      </p>
                      {getSyncStatusPresentation(item.syncStatus) ? (
                        <p className="mt-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSyncStatusPresentation(item.syncStatus)?.className}`}
                          >
                            {getSyncStatusPresentation(item.syncStatus)?.label}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleArchive(item, false)}
                      disabled={isMutatingItem}
                      className="min-h-11 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium sm:self-start"
                    >
                      {isMutatingItem ? '處理中…' : '恢復'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
            點擊上方的「顯示已封存」，就能查看與恢復已封存項目。
          </div>
        )}
      </section>
    </section>
  );

  return (
    <AppShell
      activeTab={activeTab}
      headerStatus={syncStatusPanel}
      onTabChange={navigateToTab}
      tabs={[...appTabs]}
    >
      {pageHeader}

      {activeTab === 'dashboard' ? (
        <DashboardView
          userEmail={userEmail}
          stats={
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">啟用中項目</p>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{activeItems.length}</p>
              </article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">近期紀錄</p>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{records.length}</p>
              </article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">症狀項目</p>
                <p className="mt-2 text-xl font-semibold text-rose-700 sm:text-2xl">
                  {symptomItems.length}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">同步</p>
                <p className="mt-2 text-lg font-semibold sm:text-xl">
                  {syncState.status === 'offline' ? '離線中' : syncStatusCard.statusLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  pending {syncState.pendingCount} / failed {syncState.failedCount}
                </p>
              </article>
            </div>
          }
          recentRecords={
            isHydratingLocal ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
                正在載入本機資料…
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
                目前還沒有最近紀錄。可以先到「新增紀錄」記下一筆，再回到這裡快速確認。
              </div>
            ) : (
              <>
                {renderRecords(records.slice(0, 3), true)}
                <button
                  type="button"
                  onClick={() => navigateToTab('records')}
                  className="min-h-12 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-medium"
                >
                  查看全部紀錄
                </button>
              </>
            )
          }
        />
      ) : null}

      {activeTab === 'create' ? (
        <CreateEntryView itemForm={itemForm} recordForm={recordForm} />
      ) : null}

      {activeTab === 'records' ? (
        <RecordsListView>{recordsListPanel}</RecordsListView>
      ) : null}

      {activeTab === 'reports' ? (
        <ReportsView
          summary={
            <SummaryReportSection
              initialReport={initialSummaryReport}
              maxRangeDays={maxReportRangeDays}
            />
          }
          correlation={
            <CorrelationReportSection
              initialReport={{
                ...initialCorrelationReport,
                windowHours:
                  initialCorrelationReport.windowHours ||
                  defaultCorrelationWindowHours,
              }}
              maxRangeDays={maxReportRangeDays}
              symptomItems={symptomItems}
            />
          }
        />
      ) : null}

      {activeTab === 'settings' ? (
        <SettingsView
          itemManagement={settingsPanel}
          syncStatus={
            <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
              <h2 className="text-xl font-semibold">同步狀態</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">目前狀態</p>
                  <p className="mt-2 text-lg font-semibold">{syncStatusCard.statusLabel}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">待同步</p>
                  <p className="mt-2 text-lg font-semibold">{syncState.pendingCount}</p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">上次同步</p>
                  <p className="mt-2 text-sm font-medium">{syncStatusCard.lastSyncAt}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                failed {syncState.failedCount} / conflict {syncState.conflictCount}
                {syncState.lastError ? ` / ${syncState.lastError}` : ''}
              </p>
            </section>
          }
        />
      ) : null}
    </AppShell>
  );
}
