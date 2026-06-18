'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { ItemSettingsCard } from '@/features/items/components/item-settings-card';
import { AppShell } from '@/features/records/components/app-shell';
import { CreateEntryView } from '@/features/records/components/create-entry-view';
import { DashboardView } from '@/features/records/components/dashboard-view';
import {
  RecordCard,
  RecordCardSkeleton,
  RecordList,
} from '@/features/records/components/record-card';
import { RecordsListView } from '@/features/records/components/records-list-view';
import { ReportsView } from '@/features/records/components/reports-view';
import { SettingsView } from '@/features/records/components/settings-view';
import { AccountPanel } from '@/features/auth/components/account-panel';
import { OwnershipPanel } from '@/features/ownership/components/ownership-panel';
import { authClient } from '@/lib/auth/auth-client';
import { ActionButton } from '@/components/ui/action-button';
import {
  ActivityIcon,
  ArrowRightIcon,
  HeartPulseIcon,
  LoaderIcon,
  PlusIcon,
  RefreshIcon,
  SaveIcon,
  SearchIcon,
  Undo2Icon,
  XIcon,
  type AppTabIconName,
} from '@/components/ui/icons';
import { Select } from '@/components/forms/select';
import { TextInput } from '@/components/forms/text-input';
import { Textarea } from '@/components/forms/textarea';
import {
  formatSyncIssueSummary,
  sectionCopy,
} from '@/lib/ui/section-copy';
import { buildUserGreeting } from '@/lib/ui/greeting';
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
  deleteLocalItem,
  deleteLocalRecord,
  updateLocalItem,
  updateLocalRecord,
} from '@/features/sync/local-service';
import {
  getSyncStatusPresentation,
  hydrateLocalStoreFromServerSnapshot,
  loadLocalItems,
  loadLocalRecords,
  loadSyncOperationIssues,
  mapLocalItemToItemResponse,
  mapLocalRecordToRecordResponse,
  type SyncOperationIssue,
} from '@/features/sync/local-ui';
import { getActiveLocalDataUserId } from '@/features/sync/local-user-scope';
import {
  hydrateSyncTelemetryState,
  resolveConflictKeepCloud,
  resolveConflictKeepLocal,
  retryFailedOperations,
  retrySyncOperation,
  startForegroundSync,
  runSync,
} from '@/features/sync/client-service';
import { syncOperationRepository } from '@/features/sync/local-operation-repository';
import { getSyncState, subscribeSyncState, type SyncState } from '@/features/sync/state';
import { itemLocalRepository } from '@/features/items/local-repository';
import { recordLocalRepository } from '@/features/records/local-repository';
import type { SessionUser } from '@/lib/auth/session';

type RecordDashboardProps = {
  initialItems: ItemResponse[];
  initialRecords: RecordResponse[];
  initialSummaryReport: SummaryReportResponse;
  initialCorrelationReport: CorrelationReportResponse;
  maxReportRangeDays: number;
  defaultCorrelationWindowHours: number;
  sessionUser: SessionUser | null;
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
  itemType: 'metric' | 'symptom' | 'both';
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
  { id: 'dashboard', label: 'Dashboard', mobileLabel: '首頁', icon: 'dashboard' },
  { id: 'create', label: '新增紀錄', mobileLabel: '新增', icon: 'create' },
  { id: 'records', label: '紀錄列表', mobileLabel: '紀錄', icon: 'records' },
  { id: 'reports', label: '報表', mobileLabel: '報表', icon: 'reports' },
  { id: 'settings', label: '設定', mobileLabel: '設定', icon: 'settings' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  mobileLabel: string;
  icon: AppTabIconName;
}>;

const itemTypeOptions = [
  { value: 'metric', label: '指標' },
  { value: 'symptom', label: '症狀' },
] as const;

const valueTypeOptions = [
  { value: 'number', label: '數字' },
  { value: 'boolean', label: '布林' },
  { value: 'scale', label: '量表' },
  { value: 'text', label: '文字' },
] as const;

function getValueTypeLabel(
  valueType: ItemFormState['valueType'],
  itemType?: ItemFormState['type'],
) {
  if (valueType === 'boolean' && itemType === 'symptom') {
    return '出現時記一筆';
  }

  if (valueType === 'boolean') {
    return '是 / 否';
  }

  return (
    valueTypeOptions.find((option) => option.value === valueType)?.label ??
    valueType
  );
}

function getItemTypeTabClass(
  currentValue: 'metric' | 'symptom' | 'both',
  optionValue: 'metric' | 'symptom',
) {
  if (currentValue !== optionValue) {
    return 'border-[var(--line)] bg-white text-[var(--foreground)]';
  }

  return optionValue === 'symptom'
    ? 'border-rose-400 bg-rose-500 text-white'
    : 'border-[var(--accent)] bg-[var(--accent)] text-white';
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

function getSummaryViewDescription(tabId: (typeof appTabs)[number]['id']) {
  switch (tabId) {
    case 'dashboard':
      return sectionCopy.appShortTagline;
    case 'create':
      return sectionCopy.create.page;
    case 'records':
      return sectionCopy.records.page;
    case 'reports':
      return sectionCopy.reports.page;
    case 'settings':
      return sectionCopy.settings.page;
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

function scrollToTopAfterTabChange() {
  const behavior: ScrollBehavior = window.matchMedia('(max-width: 1023px)').matches
    ? 'smooth'
    : 'auto';

  window.scrollTo({ top: 0, behavior });

  const contentContainer = document.getElementById('record-dashboard-scroll-container');
  if (contentContainer) {
    contentContainer.scrollTo({ top: 0, behavior });
  }
}

export function RecordDashboard({
  initialItems,
  initialRecords,
  initialSummaryReport,
  initialCorrelationReport,
  maxReportRangeDays,
  defaultCorrelationWindowHours,
  sessionUser,
}: RecordDashboardProps) {
  const { data: authSession } = authClient.useSession();
  const initialRecordItemType =
    initialItems.find((item) => !item.archived)?.type ?? 'metric';
  const initialTimelineItemType = 'both' as const;
  const [activeTab, setActiveTab] = useState<(typeof appTabs)[number]['id']>(
    'dashboard',
  );
  const [items, setItems] = useState(initialItems);
  const [records, setRecords] = useState(initialRecords);
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
    itemType: initialTimelineItemType,
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
  const [isRetryingSync, startRetrySyncTransition] = useTransition();
  const [activeSyncIssueId, setActiveSyncIssueId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [isHydratingLocal, setIsHydratingLocal] = useState(true);
  const [syncIssues, setSyncIssues] = useState<SyncOperationIssue[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');
  const [itemRecordHistoryCounts, setItemRecordHistoryCounts] = useState<
    Record<string, number>
  >({});

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
    () =>
      filterState.itemType === 'both'
        ? items
        : items.filter((item) => item.type === filterState.itemType),
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
  const effectiveSessionUser = useMemo(
    () =>
      authSession?.user
        ? {
            id: authSession.user.id,
            email: authSession.user.email,
            name: authSession.user.name,
            emailVerified: authSession.user.emailVerified,
          }
        : sessionUser,
    [authSession, sessionUser],
  );
  const sidebarDisplayName = effectiveSessionUser
    ? effectiveSessionUser.name?.trim() || effectiveSessionUser.email.split('@')[0] || '你'
    : null;
  const userGreeting = useMemo(
    () =>
      buildUserGreeting({
        displayName: sidebarDisplayName,
        mode: effectiveSessionUser ? 'signed-in' : 'local',
      }),
    [effectiveSessionUser, sidebarDisplayName],
  );
  const requiresAuthForCloudFeatures = effectiveSessionUser === null;

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

  const loadSyncIssues = useCallback(async () => {
    const issues = await loadSyncOperationIssues();
    setSyncIssues(issues);
  }, []);

  const loadItemRecordHistoryCounts = useCallback(async () => {
    const activeUserId = await getActiveLocalDataUserId();
    const localRecords = await recordLocalRepository.getAll({
      includeDeleted: true,
      userId: activeUserId,
    });
    const nextCounts = localRecords.reduce<Record<string, number>>(
      (counts, record) => {
        counts[record.itemId] = (counts[record.itemId] ?? 0) + 1;
        return counts;
      },
      {},
    );
    setItemRecordHistoryCounts(nextCounts);
  }, []);

  function navigateToTab(tabId: string, options?: { forceScroll?: boolean }) {
    const nextTab = appTabs.find((tab) => tab.id === tabId)?.id;

    if (!nextTab) {
      return;
    }

    if (nextTab === activeTab && !options?.forceScroll) {
      return;
    }

    setActiveTab(nextTab);
    requestAnimationFrame(scrollToTopAfterTabChange);
  }

  function handleRetryFailedSync() {
    startRetrySyncTransition(async () => {
      try {
        await retryFailedOperations();
        await runSync();
        await Promise.all([
          loadLocalData({
            preserveCurrentFilter: true,
          }),
          loadSyncIssues(),
          loadItemRecordHistoryCounts(),
        ]);
      } catch {
        // sync state already captures recovery failures.
      }
    });
  }

  function handleRetrySyncIssue(issue: SyncOperationIssue) {
    setActiveSyncIssueId(issue.operationId);
    startRetrySyncTransition(async () => {
      try {
        await retrySyncOperation(issue.operationId);
        await runSync();
        await Promise.all([
          loadLocalData({
            preserveCurrentFilter: true,
          }),
          loadSyncIssues(),
          loadItemRecordHistoryCounts(),
        ]);
      } catch {
        // sync state already captures recovery failures.
      } finally {
        setActiveSyncIssueId((current) =>
          current === issue.operationId ? null : current,
        );
      }
    });
  }

  function handleDismissSyncIssue(issue: SyncOperationIssue) {
    setActiveSyncIssueId(issue.operationId);
    startRetrySyncTransition(async () => {
      try {
        if (issue.operationType === 'create') {
          if (issue.entityType === 'item') {
            await deleteLocalItem(issue.entityId);
          } else {
            await deleteLocalRecord(issue.entityId);
          }
        } else {
          await syncOperationRepository.delete(issue.operationId);
        }

        await Promise.all([
          loadLocalData({
            preserveCurrentFilter: true,
          }),
          loadSyncIssues(),
          loadItemRecordHistoryCounts(),
        ]);
      } catch {
        // keep the issue visible if local cleanup fails.
      } finally {
        setActiveSyncIssueId((current) =>
          current === issue.operationId ? null : current,
        );
      }
    });
  }

  function handleKeepLocalConflict(issue: SyncOperationIssue) {
    setActiveSyncIssueId(issue.operationId);
    startRetrySyncTransition(async () => {
      try {
        await resolveConflictKeepLocal(issue.operationId);
        await runSync();
        await Promise.all([
          loadLocalData({
            preserveCurrentFilter: true,
          }),
          loadSyncIssues(),
          loadItemRecordHistoryCounts(),
        ]);
      } catch {
        // sync state already captures conflict resolution failures.
      } finally {
        setActiveSyncIssueId((current) =>
          current === issue.operationId ? null : current,
        );
      }
    });
  }

  function handleKeepCloudConflict(issue: SyncOperationIssue) {
    setActiveSyncIssueId(issue.operationId);
    startRetrySyncTransition(async () => {
      try {
        await resolveConflictKeepCloud(issue.operationId);
        await Promise.all([
          loadLocalData({
            preserveCurrentFilter: true,
          }),
          loadSyncIssues(),
          loadItemRecordHistoryCounts(),
        ]);
      } catch {
        // sync state already captures conflict resolution failures.
      } finally {
        setActiveSyncIssueId((current) =>
          current === issue.operationId ? null : current,
        );
      }
    });
  }

  function startRenameItem(item: ItemResponse) {
    setEditingItemId(item.id);
    setEditingItemTitle(item.title);
    setItemError(null);
    setItemNotice(null);
  }

  function cancelRenameItem() {
    setEditingItemId(null);
    setEditingItemTitle('');
  }

  async function saveRenamedItem(item: ItemResponse) {
    const nextTitle = editingItemTitle.trim();

    if (nextTitle.length === 0) {
      setItemError('請輸入項目名稱');
      return;
    }

    if (nextTitle === item.title) {
      cancelRenameItem();
      return;
    }

    setItemError(null);
    setItemNotice(null);

    startItemMutationTransition(async () => {
      try {
        const updatedItem = await updateLocalItem({
          id: item.id,
          title: nextTitle,
        });
        const data = mapLocalItemToItemResponse(updatedItem);

        setItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id ? data : currentItem,
          ),
        );
        cancelRenameItem();
        setItemNotice(`已將項目改名為「${nextTitle}」。`);
        await Promise.all([loadLocalData(), loadItemRecordHistoryCounts()]);
        void runSync().catch(() => undefined);
      } catch (error) {
        setItemError(error instanceof Error ? error.message : '更新項目失敗');
      }
    });
  }

  async function deleteItem(item: ItemResponse) {
    setItemError(null);
    setItemNotice(null);

    startItemMutationTransition(async () => {
      try {
        await deleteLocalItem(item.id);
        setItems((currentItems) =>
          currentItems.filter((currentItem) => currentItem.id !== item.id),
        );

        if (recordFormState.itemId === item.id) {
          const nextItem = activeItems.find((currentItem) => currentItem.id !== item.id);
          setRecordFormState((currentState) => ({
            ...currentState,
            itemId: nextItem?.id ?? '',
          }));
        }

        cancelRenameItem();
        setItemNotice(`已刪除「${item.title}」。`);
        await Promise.all([loadLocalData(), loadItemRecordHistoryCounts()]);
        void runSync().catch(() => undefined);
      } catch (error) {
        setItemError(error instanceof Error ? error.message : '刪除項目失敗');
      }
    });
  }

  async function moveItem(item: ItemResponse, direction: 'up' | 'down') {
    const siblingItems = items.filter(
      (currentItem) =>
        currentItem.type === item.type &&
        currentItem.archived === item.archived,
    );
    const currentIndex = siblingItems.findIndex(
      (currentItem) => currentItem.id === item.id,
    );
    const targetIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetItem = siblingItems[targetIndex];

    if (currentIndex === -1 || !targetItem) {
      return;
    }

    setItemError(null);
    setItemNotice(null);

    startItemMutationTransition(async () => {
      try {
        await updateLocalItem({
          id: item.id,
          sortOrder: targetItem.sortOrder,
        });
        await updateLocalItem({
          id: targetItem.id,
          sortOrder: item.sortOrder,
        });
        setItemNotice(
          direction === 'up'
            ? `已將「${item.title}」往前移動。`
            : `已將「${item.title}」往後移動。`,
        );
        await Promise.all([loadLocalData(), loadItemRecordHistoryCounts()]);
        void runSync().catch(() => undefined);
      } catch (error) {
        setItemError(error instanceof Error ? error.message : '調整排序失敗');
      }
    });
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

function updateTimelineItemTypeTab(nextType: 'metric' | 'symptom' | 'both') {
    setFilterState((currentState) => ({
      ...currentState,
      itemType: currentState.itemType === nextType ? 'both' : nextType,
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
    navigateToTab('create', { forceScroll: true });
  }

  function resetRecordForm() {
    setEditingRecordId(null);
    setRecordNotice(null);
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
      try {
        await hydrateSyncTelemetryState();
        await loadSyncIssues();
        await hydrateLocalStoreFromServerSnapshot({
          items: initialItems,
          records: initialRecords,
          userId: effectiveSessionUser?.id ?? null,
        });

        if (!isMounted) {
          return;
        }

        await loadLocalData();
        await loadItemRecordHistoryCounts();

        if (!isMounted) {
          return;
        }

        setIsHydratingLocal(false);
        stopForegroundSync = startForegroundSync();
        await runSync();
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setIsHydratingLocal(false);
        setTimelineError(
          error instanceof Error ? error.message : '本機資料初始化失敗',
        );
      }
    }

    void initializeLocalFirstUi();

    const unsubscribe = subscribeSyncState((nextState) => {
      setSyncState(nextState);
      void loadSyncIssues();
      void loadItemRecordHistoryCounts();

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
  }, [
    effectiveSessionUser?.id,
    initialItems,
    initialRecords,
    loadItemRecordHistoryCounts,
    loadLocalData,
    loadSyncIssues,
  ]);

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
        await Promise.all([loadLocalData(), loadItemRecordHistoryCounts()]);
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
      value =
        selectedItem.type === 'symptom'
          ? true
          : recordFormState.valueBoolean === 'true';
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
            ? `已封存「${item.title}」，之後新增紀錄時不會再出現。`
            : `已恢復「${item.title}」，現在可以再次使用。`,
        );
        await Promise.all([loadLocalData(), loadItemRecordHistoryCounts()]);
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
      <RecordList>
        {recordsToRender.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            compact={compact}
            isDeleting={isDeletingRecord}
            onEdit={compact ? undefined : populateRecordFormForEdit}
            onDelete={compact ? undefined : deleteRecord}
          />
        ))}
      </RecordList>
    );
  }

  const pageHeader = activeTab === 'dashboard'
    ? null
    : (
        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6 lg:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Nadi / {getSummaryViewTitle(activeTab)}
          </p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="max-w-[12ch] text-[2rem] leading-[1.05] font-semibold tracking-tight sm:max-w-none sm:text-[2.5rem]">
                {getSummaryViewTitle(activeTab)}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {getSummaryViewDescription(activeTab)}
              </p>
            </div>
          </div>
        </section>
      );

  const recordForm = (
    <form
      onSubmit={handleCreateRecord}
      className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">
          {editingRecordId ? '編輯紀錄' : '新增紀錄'}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {sectionCopy.create.recordForm}
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
              {itemTypeOptions.map((option) => {
                const TypeIcon =
                  option.value === 'symptom' ? HeartPulseIcon : ActivityIcon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateRecordItemTypeTab(option.value)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(recordItemTypeTab, option.value)}`}
                  >
                    <TypeIcon size={18} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
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
              <Select
                value={recordFormState.itemId}
                onChange={(event) => updateRecordFormValue('itemId', event.target.value)}
              >
                {selectableRecordItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.unit ? ` (${item.unit})` : ''}
                  </option>
                ))}
              </Select>
            )}
            {recordFieldErrors.itemId?.[0] ? (
              <span className="text-sm text-rose-700">
                {recordFieldErrors.itemId[0]}
              </span>
            ) : null}
          </label>

          {selectedItem ? (
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
                selectedItem.type === 'symptom' ? (
                  <div className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-3 text-sm text-[var(--foreground)]">
                    會自動記為「有」。
                  </div>
                ) : (
                  <Select
                    value={recordFormState.valueBoolean}
                    onChange={(event) =>
                      updateRecordFormValue(
                        'valueBoolean',
                        event.target.value as 'true' | 'false',
                      )
                    }
                  >
                    <option value="true">是</option>
                    <option value="false">否</option>
                  </Select>
                )
              ) : (
                <TextInput
                  inputMode={selectedItem.valueType === 'text' ? 'text' : 'decimal'}
                  value={recordFormState.valueText}
                  onChange={(event) =>
                    updateRecordFormValue('valueText', event.target.value)
                  }
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
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-medium">紀錄時間</span>
            <TextInput
              type="datetime-local"
              value={recordFormState.recordedAt}
              onChange={(event) => updateRecordFormValue('recordedAt', event.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">備註</span>
            <Textarea
              className="min-h-28"
              value={recordFormState.note}
              onChange={(event) => updateRecordFormValue('note', event.target.value)}
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

      <ActionButton
        type="submit"
        fullWidth
        disabled={
          activeItems.length === 0 ||
          selectableRecordItems.length === 0 ||
          isSubmittingRecord
        }
        icon={
          isSubmittingRecord ? (
            <LoaderIcon size={18} />
          ) : (
            <SaveIcon size={18} />
          )
        }
        label={
          isSubmittingRecord
            ? editingRecordId
              ? '更新紀錄中…'
              : '儲存紀錄中…'
            : editingRecordId
              ? '更新這筆紀錄'
              : '儲存這筆紀錄'
        }
        className="mt-5 text-base"
      />
      {editingRecordId ? (
        <ActionButton
          type="button"
          variant="secondary"
          fullWidth
          iconOnly
          icon={<XIcon size={18} />}
          label="取消編輯"
          onClick={resetRecordForm}
          className="mt-3"
        />
      ) : null}
    </form>
  );

  const itemForm = (
    <form
      onSubmit={handleCreateItem}
      className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6"
    >
      <div>
        <h2 className="text-xl font-semibold">新增項目</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {sectionCopy.create.itemForm}
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">項目名稱</span>
          <TextInput
            value={itemFormState.title}
            onChange={(event) => updateItemFormValue('title', event.target.value)}
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
            {itemTypeOptions.map((option) => {
              const TypeIcon =
                option.value === 'symptom' ? HeartPulseIcon : ActivityIcon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateItemFormValue('type', option.value)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(itemFormState.type, option.value)}`}
                >
                  <TypeIcon size={18} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium">值的格式</span>
          <Select
            value={itemFormState.valueType}
            onChange={(event) =>
              updateItemFormValue(
                'valueType',
                event.target.value as ItemFormState['valueType'],
              )
            }
          >
            {valueTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {itemFormState.type === 'symptom' && itemFormState.valueType === 'boolean' ? (
            <p className="text-sm leading-6 text-[var(--muted)]">
              症狀若使用布林格式，代表「出現時記一筆」。實際記錄時會自動視為有出現。
            </p>
          ) : null}
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">單位</span>
          <TextInput
            value={itemFormState.unit}
            onChange={(event) => updateItemFormValue('unit', event.target.value)}
            placeholder="例如：小時、杯、次"
          />
        </label>

        {itemFormState.valueType === 'scale' ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium">量表最小值</span>
              <TextInput
                inputMode="numeric"
                value={itemFormState.scaleMin}
                onChange={(event) => updateItemFormValue('scaleMin', event.target.value)}
                placeholder="0"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">量表最大值</span>
              <TextInput
                inputMode="numeric"
                value={itemFormState.scaleMax}
                onChange={(event) => updateItemFormValue('scaleMax', event.target.value)}
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

      <ActionButton
        type="submit"
        fullWidth
        disabled={isSubmittingItem}
        icon={
          isSubmittingItem ? <LoaderIcon size={18} /> : <PlusIcon size={18} />
        }
        label={isSubmittingItem ? '建立項目中…' : '建立新項目'}
        className="mt-5 text-base"
      />
    </form>
  );

  const recordsListPanel = (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">紀錄列表</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {sectionCopy.records.list}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-3 text-sm text-[var(--muted)]">
          目前顯示 {records.length} 筆
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-2">
          <span className="text-sm font-medium">查詢類型</span>
          <div className="grid grid-cols-2 gap-2">
            {itemTypeOptions.map((option) => {
              const TypeIcon =
                option.value === 'symptom' ? HeartPulseIcon : ActivityIcon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateTimelineItemTypeTab(option.value)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${getItemTypeTabClass(filterState.itemType, option.value)}`}
                >
                  <TypeIcon size={18} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium">項目篩選</span>
            <Select
              value={filterState.itemId}
              onChange={(event) => updateFilterValue('itemId', event.target.value)}
            >
              <option value="">
                {filterState.itemType === 'both'
                  ? '全部項目'
                  : `全部${filterState.itemType === 'metric' ? '指標' : '症狀'}`}
              </option>
              {timelineSelectableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.archived ? '（已封存）' : ''}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">開始日期</span>
              <TextInput
                type="date"
                value={filterState.from}
                onChange={(event) => updateFilterValue('from', event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">結束日期</span>
              <TextInput
                type="date"
                value={filterState.to}
                onChange={(event) => updateFilterValue('to', event.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ActionButton
          type="button"
          iconOnly
          disabled={isLoadingTimeline}
          icon={
            isLoadingTimeline ? (
              <LoaderIcon size={18} />
            ) : (
              <SearchIcon size={18} />
            )
          }
          label={isLoadingTimeline ? '整理紀錄中…' : '套用條件'}
          onClick={fetchTimeline}
        />
        <ActionButton
          type="button"
          variant="secondary"
          iconOnly
          icon={<Undo2Icon size={18} />}
          label="回到近期列表"
          onClick={() => {
            setFilterState({
              itemType: initialTimelineItemType,
              itemId: '',
              from: '',
              to: '',
            });
            setTimelineError(null);
            void loadLocalData();
          }}
        />
      </div>

      {timelineError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {timelineError}
        </p>
      ) : null}

      <div className="mt-5">
        {isLoadingTimeline ? (
          <RecordList>
            {Array.from({ length: 3 }).map((_, index) => (
              <RecordCardSkeleton key={`timeline-loading-${index}`} />
            ))}
          </RecordList>
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
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
        <div>
          <h2 className="text-xl font-semibold">項目列表</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {sectionCopy.settings.activeItems}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {activeItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
              目前還沒有啟用中的項目。你可以先建立一個最常記錄的指標，像是睡眠、喝水或頭痛程度。
            </div>
          ) : (
            activeItems.map((item) => {
              const siblingItems = activeItems.filter(
                (currentItem) => currentItem.type === item.type,
              );

              return (
                <ItemSettingsCard
                  key={item.id}
                  item={item}
                  variant="active"
                  recordHistoryCount={itemRecordHistoryCounts[item.id] ?? 0}
                  isMutating={isMutatingItem}
                  isEditing={editingItemId === item.id}
                  editingTitle={editingItemTitle}
                  onEditingTitleChange={setEditingItemTitle}
                  onStartEdit={() => startRenameItem(item)}
                  onCancelEdit={cancelRenameItem}
                  onSaveEdit={() => void saveRenamedItem(item)}
                  onDelete={() => void deleteItem(item)}
                  onToggleArchive={() => void toggleArchive(item, true)}
                  onMoveUp={() => void moveItem(item, 'up')}
                  onMoveDown={() => void moveItem(item, 'down')}
                  canMoveUp={siblingItems[0]?.id !== item.id}
                  canMoveDown={siblingItems.at(-1)?.id !== item.id}
                  valueTypeLabel={getValueTypeLabel(item.valueType, item.type)}
                />
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
        <h2 className="text-xl font-semibold">已封存項目</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {sectionCopy.settings.archivedItems}
        </p>

        <div className="mt-5 grid gap-3">
          {archivedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
              目前沒有已封存項目。
            </div>
          ) : (
            archivedItems.map((item) => {
              const siblingItems = archivedItems.filter(
                (currentItem) => currentItem.type === item.type,
              );

              return (
                <ItemSettingsCard
                  key={item.id}
                  item={item}
                  variant="archived"
                  recordHistoryCount={itemRecordHistoryCounts[item.id] ?? 0}
                  isMutating={isMutatingItem}
                  isEditing={editingItemId === item.id}
                  editingTitle={editingItemTitle}
                  onEditingTitleChange={setEditingItemTitle}
                  onStartEdit={() => startRenameItem(item)}
                  onCancelEdit={cancelRenameItem}
                  onSaveEdit={() => void saveRenamedItem(item)}
                  onDelete={() => void deleteItem(item)}
                  onToggleArchive={() => void toggleArchive(item, false)}
                  onMoveUp={() => void moveItem(item, 'up')}
                  onMoveDown={() => void moveItem(item, 'down')}
                  canMoveUp={siblingItems[0]?.id !== item.id}
                  canMoveDown={siblingItems.at(-1)?.id !== item.id}
                  valueTypeLabel={getValueTypeLabel(item.valueType, item.type)}
                />
              );
            })
          )}
        </div>
      </section>
    </section>
  );

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={navigateToTab}
      sidebarSyncSummary={{
        statusLabel: syncStatusCard.statusLabel,
        pendingCount: syncState.pendingCount,
        failedCount: syncState.failedCount,
        conflictCount: syncState.conflictCount,
        lastSyncAt: syncStatusCard.lastSyncAt,
      }}
      tabs={[...appTabs]}
    >
      {pageHeader}

      {activeTab === 'dashboard' ? (
        <DashboardView
          userGreeting={userGreeting}
          stats={
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">近期紀錄</p>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{records.length}</p>
              </article>
              <article className="rounded-2xl border border-[var(--line)] bg-white/80 p-3 sm:p-4">
                <p className="text-sm text-[var(--muted)]">同步</p>
                <p className="mt-2 text-lg font-semibold sm:text-xl">
                  {syncState.status === 'offline' ? '離線中' : syncStatusCard.statusLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  待同步 {syncState.pendingCount} 筆 · 失敗 {syncState.failedCount} 筆
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
              <div className="grid gap-3">
                {renderRecords(records.slice(0, 3), true)}
                <ActionButton
                  type="button"
                  variant="secondary"
                  fullWidth
                  iconOnly
                  icon={<ArrowRightIcon size={18} />}
                  label="查看全部紀錄"
                  onClick={() => navigateToTab('records')}
                />
              </div>
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
              requiresAuth={requiresAuthForCloudFeatures}
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
              requiresAuth={requiresAuthForCloudFeatures}
            />
          }
        />
      ) : null}

      {activeTab === 'settings' ? (
        <SettingsView
          accountManagement={<AccountPanel initialSessionUser={sessionUser} />}
          ownershipManagement={<OwnershipPanel enabled={Boolean(sessionUser)} />}
          itemManagement={settingsPanel}
          syncStatus={
            <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
              <h2 className="text-xl font-semibold">同步狀態</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {sectionCopy.settings.sync}
              </p>
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">目前裝置 session</p>
                  <p className="mt-2 text-sm font-medium">
                    {syncState.deviceSession?.deviceId ?? '尚未建立'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">Checkpoint</p>
                  <p className="mt-2 text-sm font-medium">
                    {formatSyncTimestamp(
                      syncState.deviceSession?.lastCheckpointAt ?? null,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
                  <p className="text-sm text-[var(--muted)]">最近同步訊息</p>
                  <p className="mt-2 text-sm font-medium">
                    {syncState.diagnostics?.lastMessage ?? '目前沒有同步訊息'}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                {formatSyncIssueSummary({
                  failedCount: syncState.failedCount,
                  conflictCount: syncState.conflictCount,
                  lastError: syncState.lastError,
                })}
              </p>
              {syncState.failedCount > 0 ? (
                <div className="mt-4">
                  <ActionButton
                    type="button"
                    variant="secondary"
                    icon={<RefreshIcon size={18} />}
                    label={isRetryingSync ? '正在重新排隊與同步…' : '重新排隊並重試同步'}
                    onClick={handleRetryFailedSync}
                    disabled={isRetryingSync}
                  />
                </div>
              ) : null}
              <div className="mt-4 grid gap-3">
                {syncIssues.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                    目前沒有需要人工確認的同步失敗或衝突。
                  </div>
                ) : (
                  syncIssues.map((issue) => (
                    <article
                      key={issue.operationId}
                      className="rounded-2xl border border-[var(--line)] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            issue.status === 'conflict'
                              ? 'rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800'
                              : 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-800'
                          }
                        >
                          {issue.statusLabel}
                        </span>
                        <p className="text-sm font-medium">{issue.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        實體 ID：{issue.entityId}
                      </p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">
                        原因：{issue.displayError}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        最近更新：{formatSyncTimestamp(issue.updatedAt)}
                      </p>
                      {issue.comparisonRows.length > 0 ? (
                        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)]">
                          <div className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] bg-stone-50 px-3 py-2 text-xs text-[var(--muted)]">
                            <p>欄位</p>
                            <p>本機</p>
                            <p>雲端</p>
                          </div>
                          {issue.comparisonRows.map((row) => (
                            <div
                              key={`${issue.operationId}:${row.label}`}
                              className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-[var(--line)] px-3 py-2 text-sm"
                            >
                              <p className="text-[var(--muted)]">{row.label}</p>
                              <p className="break-words">{row.localValue}</p>
                              <p className="break-words text-[var(--muted)]">{row.cloudValue}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {issue.debugDetails.length > 0 ? (
                        <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-3 text-xs text-[var(--muted)]">
                          {issue.debugDetails.map((detail) => (
                            <p key={detail} className="break-all">
                              {detail}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {issue.status === 'failed' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionButton
                            type="button"
                            variant="secondary"
                            icon={<RefreshIcon size={18} />}
                            label={
                              activeSyncIssueId === issue.operationId
                                ? '處理中…'
                                : '重試這筆'
                            }
                            onClick={() => handleRetrySyncIssue(issue)}
                            disabled={isRetryingSync}
                          />
                          <ActionButton
                            type="button"
                            variant="secondary"
                            icon={<XIcon size={18} />}
                            label={
                              issue.operationType === 'create'
                                ? '刪除本機資料'
                                : '清除此錯誤'
                            }
                            onClick={() => handleDismissSyncIssue(issue)}
                            disabled={isRetryingSync}
                          />
                        </div>
                      ) : issue.status === 'conflict' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ActionButton
                            type="button"
                            icon={<RefreshIcon size={18} />}
                            label={
                              activeSyncIssueId === issue.operationId
                                ? '處理中…'
                                : '保留本機版本'
                            }
                            onClick={() => handleKeepLocalConflict(issue)}
                            disabled={isRetryingSync}
                          />
                          <ActionButton
                            type="button"
                            variant="secondary"
                            icon={<SaveIcon size={18} />}
                            label="保留雲端版本"
                            onClick={() => handleKeepCloudConflict(issue)}
                            disabled={isRetryingSync}
                          />
                          <ActionButton
                            type="button"
                            variant="secondary"
                            icon={<XIcon size={18} />}
                            label="先保留待處理"
                            onClick={() => setActiveSyncIssueId(null)}
                            disabled={isRetryingSync}
                          />
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          }
        />
      ) : null}
    </AppShell>
  );
}
