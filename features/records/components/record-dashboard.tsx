'use client';

import { useMemo, useState, useTransition } from 'react';

import type { ItemResponse } from '@/features/items/api';
import type { RecordResponse } from '@/features/records/api';
import type { SummaryReportResponse } from '@/features/reports/api';
import { SummaryReportSection } from '@/features/reports/components/summary-report-section';

type RecordDashboardProps = {
  initialItems: ItemResponse[];
  initialRecords: RecordResponse[];
  initialSummaryReport: SummaryReportResponse;
  maxReportRangeDays: number;
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

export function RecordDashboard({
  initialItems,
  initialRecords,
  initialSummaryReport,
  maxReportRangeDays,
  userEmail,
}: RecordDashboardProps) {
  const initialRecordItemType =
    initialItems.find((item) => !item.archived)?.type ?? 'metric';
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
  const [filterState, setFilterState] = useState<FilterState>({
    itemId: '',
    from: '',
    to: '',
  });
  const [itemFieldErrors, setItemFieldErrors] = useState<ApiFieldErrors>({});
  const [recordFieldErrors, setRecordFieldErrors] = useState<ApiFieldErrors>({});
  const [itemError, setItemError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [isSubmittingItem, startItemTransition] = useTransition();
  const [isSubmittingRecord, startRecordTransition] = useTransition();
  const [isLoadingTimeline, startTimelineTransition] = useTransition();
  const [isMutatingItem, startItemMutationTransition] = useTransition();
  const [isDeletingRecord, startDeleteTransition] = useTransition();

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
  const selectedItem = useMemo(
    () =>
      selectableRecordItems.find((item) => item.id === recordFormState.itemId) ??
      null,
    [recordFormState.itemId, selectableRecordItems],
  );

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

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItemError(null);
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
      const response = await fetch('/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setItemError(data.error?.message ?? '建立項目失敗');
        setItemFieldErrors(data.error?.fieldErrors ?? {});
        return;
      }

      setItems((currentItems) => [data, ...currentItems]);
      setItemFormState(defaultItemFormState);
      setRecordItemTypeTab(data.type);
      setRecordFormState((currentState) => ({
        ...currentState,
        itemId: data.id,
      }));
    });
  }

  async function handleCreateRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecordError(null);
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
      const response = await fetch('/v1/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: selectedItem.id,
          value,
          recordedAt: localInputToIso(recordFormState.recordedAt),
          note: recordFormState.note,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRecordError(data.error?.message ?? '建立紀錄失敗');
        setRecordFieldErrors(data.error?.fieldErrors ?? {});
        return;
      }

      setRecords((currentRecords) => [data, ...currentRecords].slice(0, 20));
      setRecordFormState((currentState) => ({
        ...currentState,
        valueText: '',
        valueBoolean: 'true',
        note: '',
        recordedAt: formatDateTimeLocal(),
      }));
    });
  }

  async function toggleArchive(item: ItemResponse, archived: boolean) {
    startItemMutationTransition(async () => {
      const response = await fetch(`/v1/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived }),
      });
      const data = await response.json();

      if (!response.ok) {
        setItemError(data.error?.message ?? '更新項目失敗');
        return;
      }

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
    });
  }

  async function fetchTimeline() {
    setTimelineError(null);

    const params = new URLSearchParams();

    if (filterState.itemId) {
      params.set('itemId', filterState.itemId);
    }

    const from = dateInputToRange(filterState.from, 'start');
    const to = dateInputToRange(filterState.to, 'end');

    if (from && to) {
      params.set('from', from);
      params.set('to', to);
    }

    startTimelineTransition(async () => {
      const response = await fetch(`/v1/records?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setTimelineError(data.error?.message ?? '讀取紀錄失敗');
        return;
      }

      setRecords(data.records);
    });
  }

  async function deleteRecord(recordId: string) {
    startDeleteTransition(async () => {
      const response = await fetch(`/v1/records/${recordId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setTimelineError(data.error?.message ?? '刪除紀錄失敗');
        return;
      }

      setRecords((currentRecords) =>
        currentRecords.filter((record) => record.id !== recordId),
      );
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(31,42,42,0.08)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Nadi / Phase 3
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                建立每日紀錄
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                先選擇現有項目，再快速記下一筆。預設列表會顯示近期紀錄，已封存項目的歷史紀錄仍可查詢。
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
              目前使用者：{userEmail}
            </div>
          </div>
        </section>

        <SummaryReportSection
          initialReport={initialSummaryReport}
          maxRangeDays={maxReportRangeDays}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={handleCreateRecord}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">新增紀錄</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                優先支援手機操作，盡量用最少欄位完成一筆紀錄。
              </p>
            </div>

            {activeItems.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-5 text-sm text-[var(--muted)]">
                尚未建立任何啟用中的項目。請先到下方建立紀錄項目。
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
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                          recordItemTypeTab === option.value
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--line)] bg-white text-[var(--foreground)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">選擇項目</span>
                  {selectableRecordItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-4 text-sm text-[var(--muted)]">
                      目前沒有可用的
                      {recordItemTypeTab === 'metric' ? '指標' : '症狀'}
                      項目，請先在下方建立。
                    </div>
                  ) : (
                    <select
                      value={recordFormState.itemId}
                      onChange={(event) =>
                        updateRecordFormValue('itemId', event.target.value)
                      }
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
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
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : (
                      <input
                        inputMode={
                          selectedItem.valueType === 'text' ? 'text' : 'decimal'
                        }
                        value={recordFormState.valueText}
                        onChange={(event) =>
                          updateRecordFormValue('valueText', event.target.value)
                        }
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                        placeholder={
                          selectedItem.valueType === 'text'
                            ? '輸入紀錄內容'
                            : selectedItem.valueType === 'scale'
                              ? '輸入量表分數'
                              : '輸入數值'
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
                  <input
                    type="datetime-local"
                    value={recordFormState.recordedAt}
                    onChange={(event) =>
                      updateRecordFormValue('recordedAt', event.target.value)
                    }
                    className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  />
                  {recordFieldErrors.recordedAt?.[0] ? (
                    <span className="text-sm text-rose-700">
                      {recordFieldErrors.recordedAt[0]}
                    </span>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">備註</span>
                  <textarea
                    value={recordFormState.note}
                    onChange={(event) =>
                      updateRecordFormValue('note', event.target.value)
                    }
                    className="min-h-24 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                    placeholder="可留空，例如：午睡後、晚餐後"
                  />
                  {recordFieldErrors.note?.[0] ? (
                    <span className="text-sm text-rose-700">
                      {recordFieldErrors.note[0]}
                    </span>
                  ) : null}
                </label>
              </div>
            )}

            {recordError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {recordError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                activeItems.length === 0 ||
                selectableRecordItems.length === 0 ||
                isSubmittingRecord
              }
              className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingRecord ? '建立中…' : '建立紀錄'}
            </button>
          </form>

          <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">近期紀錄</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  預設顯示近期資料，也可以用日期區間與項目篩選。
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium">項目篩選</span>
                <select
                  value={filterState.itemId}
                  onChange={(event) =>
                    updateFilterValue('itemId', event.target.value)
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                >
                  <option value="">全部項目</option>
                  {items.map((item) => (
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
                  onChange={(event) =>
                    updateFilterValue('from', event.target.value)
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">結束日期</span>
                <input
                  type="date"
                  value={filterState.to}
                  onChange={(event) => updateFilterValue('to', event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={fetchTimeline}
                disabled={isLoadingTimeline}
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isLoadingTimeline ? '查詢中…' : '查詢紀錄'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterState({ itemId: '', from: '', to: '' });
                  setTimelineError(null);
                  setRecords(initialRecords);
                }}
                className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-medium"
              >
                清除條件
              </button>
            </div>

            {timelineError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {timelineError}
              </p>
            ) : null}

            <div className="mt-5 grid gap-3">
              {records.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm text-[var(--muted)]">
                  目前沒有符合條件的紀錄。
                </div>
              ) : (
                records.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-[var(--line)] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {record.itemTitle}
                          </h3>
                          {record.itemArchived ? (
                            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                              已封存項目
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-lg font-medium">
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
                      <button
                        type="button"
                        onClick={() => deleteRecord(record.id)}
                        disabled={isDeletingRecord}
                        className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium"
                      >
                        刪除
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={handleCreateItem}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-6"
          >
            <div>
              <h2 className="text-xl font-semibold">新增項目</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                若還缺少可選項目，可直接在這裡補上。
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium">項目名稱</span>
                <input
                  value={itemFormState.title}
                  onChange={(event) =>
                    updateItemFormValue('title', event.target.value)
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
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
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        itemFormState.type === option.value
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--line)] bg-white text-[var(--foreground)]'
                      }`}
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
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                >
                  {valueTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {itemFieldErrors.valueType?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {itemFieldErrors.valueType[0]}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">單位</span>
                <input
                  value={itemFormState.unit}
                  onChange={(event) =>
                    updateItemFormValue('unit', event.target.value)
                  }
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  placeholder="例如：小時、杯、次"
                />
                {itemFieldErrors.unit?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {itemFieldErrors.unit[0]}
                  </span>
                ) : null}
              </label>

              {itemFormState.valueType === 'scale' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">量表最小值</span>
                    <input
                      inputMode="numeric"
                      value={itemFormState.scaleMin}
                      onChange={(event) =>
                        updateItemFormValue('scaleMin', event.target.value)
                      }
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                      placeholder="0"
                    />
                    {itemFieldErrors.scaleMin?.[0] ? (
                      <span className="text-sm text-rose-700">
                        {itemFieldErrors.scaleMin[0]}
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">量表最大值</span>
                    <input
                      inputMode="numeric"
                      value={itemFormState.scaleMax}
                      onChange={(event) =>
                        updateItemFormValue('scaleMax', event.target.value)
                      }
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                      placeholder="10"
                    />
                    {itemFieldErrors.scaleMax?.[0] ? (
                      <span className="text-sm text-rose-700">
                        {itemFieldErrors.scaleMax[0]}
                      </span>
                    ) : null}
                  </label>
                </div>
              ) : null}
            </div>

            {itemError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {itemError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmittingItem}
              className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingItem ? '建立中…' : '建立項目'}
            </button>
          </form>

          <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">項目列表</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  預設只顯示啟用中的項目。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchived((value) => !value)}
                className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm font-medium"
              >
                {showArchived ? '隱藏已封存' : '顯示已封存'}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {activeItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm text-[var(--muted)]">
                  目前還沒有啟用中的項目。先建立一個最常記錄的項目開始。
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
                          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                            {item.type === 'metric' ? '指標' : '症狀'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          格式：
                          {
                            valueTypeOptions.find(
                              (option) => option.value === item.valueType,
                            )?.label
                          }
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
                        className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--foreground)]"
                      >
                        封存
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            {showArchived ? (
              <div className="mt-6 border-t border-[var(--line)] pt-6">
                <h3 className="text-base font-semibold">已封存項目</h3>
                <div className="mt-3 grid gap-3">
                  {archivedItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-stone-50 px-4 py-5 text-sm text-[var(--muted)]">
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
                            <h4 className="text-base font-semibold">{item.title}</h4>
                            <p className="mt-2 text-sm text-[var(--muted)]">
                              {item.type === 'metric' ? '指標' : '症狀'} /{' '}
                              {
                                valueTypeOptions.find(
                                  (option) => option.value === item.valueType,
                                )?.label
                              }
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleArchive(item, false)}
                            disabled={isMutatingItem}
                            className="rounded-2xl border border-[var(--line)] px-3 py-2 text-sm font-medium"
                          >
                            恢復
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
