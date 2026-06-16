'use client';

import { useMemo, useState, useTransition } from 'react';

import { ActionButton } from '@/components/ui/action-button';
import {
  ClockIcon,
  LoaderIcon,
  SearchIcon, Undo2Icon,
} from '@/components/ui/icons';
import { Select } from '@/components/forms/select';
import { TextInput } from '@/components/forms/text-input';
import type { ItemResponse } from '@/features/items/api';
import type { CorrelationReportResponse } from '@/features/reports/api';
import { getDefaultCorrelationDescription } from '@/features/reports/correlation';

type CorrelationReportSectionProps = {
  initialReport: CorrelationReportResponse;
  maxRangeDays: number;
  symptomItems: ItemResponse[];
  requiresAuth?: boolean;
};

type CorrelationFilterState = {
  symptomItemId: string;
  from: string;
  to: string;
  windowHours: number;
};

const windowOptions = [24, 48, 72] as const;
const valueTypeLabelMap = {
  number: '數字',
  boolean: '是 / 否',
  scale: '量表',
  text: '文字',
} as const;

function toDateInputValue(value: string) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function toRangeIso(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return `${value}${suffix}`;
}

function formatScore(score: number) {
  return `${score > 0 ? '+' : ''}${score.toFixed(2)}`;
}

function getScoreClass(score: number) {
  if (score >= 0.2) {
    return 'bg-rose-100 text-rose-700';
  }

  if (score <= -0.2) {
    return 'bg-sky-100 text-sky-700';
  }

  return 'bg-stone-100 text-stone-700';
}

export function CorrelationReportSection({
  initialReport,
  maxRangeDays,
  symptomItems,
  requiresAuth = false,
}: CorrelationReportSectionProps) {
  const [report, setReport] = useState(initialReport);
  const [filterState, setFilterState] = useState<CorrelationFilterState>({
    symptomItemId: initialReport.symptomItemId,
    from: toDateInputValue(initialReport.from),
    to: toDateInputValue(initialReport.to),
    windowHours: initialReport.windowHours,
  });
  const [reportError, setReportError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const effectiveSymptomItemId = useMemo(() => {
    const hasCurrentItem = symptomItems.some(
      (item) => item.id === filterState.symptomItemId,
    );

    if (hasCurrentItem) {
      return filterState.symptomItemId;
    }

    return symptomItems[0]?.id ?? '';
  }, [filterState.symptomItemId, symptomItems]);

  const selectedSymptomItem = useMemo(
    () => symptomItems.find((item) => item.id === effectiveSymptomItemId) ?? null,
    [effectiveSymptomItemId, symptomItems],
  );

  function updateFilter<Key extends keyof CorrelationFilterState>(
    key: Key,
    value: CorrelationFilterState[Key],
  ) {
    setFilterState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  async function fetchReport() {
    if (requiresAuth) {
      setReportError('登入帳號並連結裝置後，才能讀取雲端關聯觀察。');
      return;
    }

    if (!effectiveSymptomItemId) {
      return;
    }

    setReportError(null);

    startTransition(async () => {
      const params = new URLSearchParams({
        symptomItemId: effectiveSymptomItemId,
        from: toRangeIso(filterState.from, 'start'),
        to: toRangeIso(filterState.to, 'end'),
        windowHours: String(filterState.windowHours),
      });
      const response = await fetch(`/v1/reports/correlation?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setReportError(data.error?.message ?? '讀取 correlation 報表失敗');
        return;
      }

      setReport(data);
    });
  }

  function resetFilter() {
    setFilterState({
      symptomItemId: initialReport.symptomItemId,
      from: toDateInputValue(initialReport.from),
      to: toDateInputValue(initialReport.to),
      windowHours: initialReport.windowHours,
    });
    setReport(initialReport);
    setReportError(null);
  }

  return (
    <section className="rounded-[1.75rem] border border-rose-100 bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-rose-700">關聯觀察</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            這裡只整理可能相關的模式，幫助你回頭觀察症狀前後的紀錄，不代表因果關係或醫療結論。
          </p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          最大查詢範圍：{maxRangeDays} 天
        </div>
      </div>

      {symptomItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 px-4 py-6 text-sm leading-6 text-[var(--muted)]">
          你還沒有症狀項目。先建立一個症狀項目，之後才能查看相對關聯。
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-medium">分析目標症狀</span>
              <Select
                variant="symptom"
                value={effectiveSymptomItemId}
                onChange={(event) =>
                  updateFilter('symptomItemId', event.target.value)
                }
              >
                {symptomItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.archived ? '（已封存）' : ''}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">開始日期</span>
              <TextInput
                variant="symptom"
                type="date"
                value={filterState.from}
                onChange={(event) => updateFilter('from', event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">結束日期</span>
              <TextInput
                variant="symptom"
                type="date"
                value={filterState.to}
                onChange={(event) => updateFilter('to', event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">觀察窗口</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {windowOptions.map((windowHours) => {
                const isActive = filterState.windowHours === windowHours;

                return (
                  <button
                    key={windowHours}
                    type="button"
                    onClick={() => updateFilter('windowHours', windowHours)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'border-rose-400 bg-rose-500 text-white'
                        : 'border-[var(--line)] bg-white text-[var(--foreground)]'
                    }`}
                  >
                    <ClockIcon size={18} />
                    <span>{windowHours}h</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <ActionButton
              type="button"
              variant="symptom"
              iconOnly
              disabled={isLoading || !effectiveSymptomItemId}
              icon={
                isLoading ? <LoaderIcon size={18} /> : <SearchIcon size={18} />
              }
              label={isLoading ? '整理關聯中…' : '更新觀察'}
              onClick={fetchReport}
            />
            <ActionButton
              type="button"
              variant="secondary"
              iconOnly
              disabled={isLoading}
              icon={<Undo2Icon size={18} />}
              label="回到預設條件"
              onClick={resetFilter}
            />
          </div>
        </>
      )}

      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          正在比對症狀前後的紀錄，樣本越多，結果通常越穩定。
        </p>
      ) : null}

      {reportError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {reportError}
        </p>
      ) : null}

      {requiresAuth ? (
        <div className="mt-5 rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 px-4 py-6 text-sm leading-6 text-[var(--muted)]">
          目前是本機模式。登入並連結裝置後，這裡才會整理帳號資料中的相對關聯。
        </div>
      ) : null}

      {!requiresAuth && symptomItems.length > 0 ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
            <p className="text-sm font-medium text-rose-700">
              {(selectedSymptomItem?.title ?? report.symptomTitle) || '症狀觀察'}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {getDefaultCorrelationDescription(report)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">症狀事件數</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">
                {report.symptomSampleSize}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">最小樣本門檻</p>
              <p className="mt-2 text-2xl font-semibold">
                {report.minimumSampleSize}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">目前窗口</p>
              <p className="mt-2 text-sm font-medium leading-6">
                前 {report.windowHours} 小時
              </p>
            </article>
          </div>

          {report.candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
              目前沒有可整理的候選項目。這通常表示資料仍少，或在這個區間內還看不出明顯模式。
            </div>
          ) : (
            <div className="grid gap-3">
              {report.candidates.map((candidate) => (
                <article
                  key={candidate.itemId}
                  className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{candidate.title}</h3>
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent)]">
                          {valueTypeLabelMap[candidate.valueType]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {candidate.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${getScoreClass(candidate.correlationScore)}`}
                    >
                      觀察分數 {formatScore(candidate.correlationScore)}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--muted)]">
                    <div>
                      <dt>樣本數</dt>
                      <dd className="mt-1 font-medium text-[var(--foreground)]">
                        {candidate.sampleSize}
                      </dd>
                    </div>
                    <div>
                      <dt>單位</dt>
                      <dd className="mt-1 font-medium text-[var(--foreground)]">
                        {candidate.unit ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
