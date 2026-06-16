'use client';

import { useState, useTransition } from 'react';

import { ActionButton } from '@/components/ui/action-button';
import { LoaderIcon, SearchIcon, Undo2Icon } from '@/components/ui/icons';
import { TextInput } from '@/components/forms/text-input';
import type { SummaryReportResponse } from '@/features/reports/api';
import {
  formatMetricPreviewValue,
  formatSymptomPreviewValue,
} from '@/features/reports/summary';

type SummaryReportSectionProps = {
  initialReport: SummaryReportResponse;
  maxRangeDays: number;
};

type ReportFilterState = {
  from: string;
  to: string;
};

const valueTypeLabelMap = {
  number: '數字',
  boolean: '是 / 否',
  scale: '量表',
  text: '文字',
} as const;

function toDateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function toRangeIso(value: string, edge: 'start' | 'end') {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return `${value}${suffix}`;
}

export function SummaryReportSection({
  initialReport,
  maxRangeDays,
}: SummaryReportSectionProps) {
  const [report, setReport] = useState(initialReport);
  const [filterState, setFilterState] = useState<ReportFilterState>({
    from: toDateInputValue(initialReport.from),
    to: toDateInputValue(initialReport.to),
  });
  const [reportError, setReportError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const hasData =
    report.metrics.length > 0 || report.symptoms.length > 0;
  const maxMetricCount = Math.max(
    1,
    ...report.metrics.map((metric) => metric.count),
  );
  const maxSymptomCount = Math.max(
    1,
    ...report.symptoms.map((symptom) => symptom.occurrenceCount),
  );

  function updateFilter(key: keyof ReportFilterState, value: string) {
    setFilterState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  async function fetchReport() {
    setReportError(null);

    startTransition(async () => {
      const params = new URLSearchParams({
        from: toRangeIso(filterState.from, 'start'),
        to: toRangeIso(filterState.to, 'end'),
      });
      const response = await fetch(`/v1/reports/summary?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setReportError(data.error?.message ?? '讀取報表失敗');
        return;
      }

      setReport(data);
    });
  }

  function resetFilter() {
    setFilterState({
      from: toDateInputValue(initialReport.from),
      to: toDateInputValue(initialReport.to),
    });
    setReportError(null);
    setReport(initialReport);
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">摘要報表</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            這裡整理目前區間內的基礎統計，幫助你回頭閱讀自己的紀錄，不代表任何醫療結論。
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          最大查詢範圍：{maxRangeDays} 天
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium">開始日期</span>
          <TextInput
            type="date"
            value={filterState.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium">結束日期</span>
          <TextInput
            type="date"
            value={filterState.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ActionButton
          type="button"
          iconOnly
          disabled={isLoading}
          icon={
            isLoading ? <LoaderIcon size={18} /> : <SearchIcon size={18} />
          }
          label={isLoading ? '整理摘要中…' : '更新摘要'}
          onClick={fetchReport}
        />
        <ActionButton
          type="button"
          variant="secondary"
          iconOnly
          disabled={isLoading}
          icon={<Undo2Icon size={18} />}
          label="回到預設區間"
          onClick={resetFilter}
        />
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          正在整理這段時間的紀錄，通常只需要幾秒鐘。
        </p>
      ) : null}

      {reportError ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {reportError}
        </p>
      ) : null}

      {!hasData ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-6 text-sm leading-6 text-[var(--muted)]">
          目前選定區間內的資料仍不足以形成摘要。你可以持續記錄，之後再回來查看。
        </div>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">指標項目數</p>
              <p className="mt-2 text-2xl font-semibold">{report.metrics.length}</p>
            </article>
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">症狀項目數</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">
                {report.symptoms.length}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <p className="text-sm text-[var(--muted)]">統計區間</p>
              <p className="mt-2 text-sm font-medium leading-6">
                {filterState.from} 至 {filterState.to}
              </p>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">指標摘要</h3>
                <span className="text-sm text-[var(--muted)]">以數量較多的項目排前面</span>
              </div>
              <div className="mt-4 grid gap-3">
                {report.metrics.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-6 text-[var(--muted)]">
                    這段時間內還沒有指標資料。
                    你可以先回到上方新增一筆數值、布林或量表型紀錄。
                  </div>
                ) : (
                  report.metrics.map((metric) => (
                    <article
                      key={metric.itemId}
                      className="rounded-2xl border border-[var(--line)] bg-stone-50 p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{metric.title}</h4>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {metric.count} 筆紀錄 / {valueTypeLabelMap[metric.valueType]}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatMetricPreviewValue(metric)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-stone-200">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{
                            width: `${(metric.count / maxMetricCount) * 100}%`,
                          }}
                        />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--muted)]">
                        <div>
                          <dt>總和</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {metric.total ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>平均</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {metric.avg ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>最小值</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {metric.min ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>最大值</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {metric.max ?? '—'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-rose-700">症狀摘要</h3>
                <span className="text-sm text-rose-600">保留觀察語氣，不做推論</span>
              </div>
              <div className="mt-4 grid gap-3">
                {report.symptoms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-sm leading-6 text-[var(--muted)]">
                    這段時間內還沒有症狀資料。
                    若你想觀察關聯變化，可以先持續記錄症狀出現的時間與程度。
                  </div>
                ) : (
                  report.symptoms.map((symptom) => (
                    <article
                      key={symptom.itemId}
                      className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{symptom.title}</h4>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {symptom.occurrenceCount} 次出現 / {valueTypeLabelMap[symptom.valueType]}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatSymptomPreviewValue(symptom)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-stone-200">
                        <div
                          className="h-2 rounded-full bg-rose-500"
                          style={{
                            width: `${(symptom.occurrenceCount / maxSymptomCount) * 100}%`,
                          }}
                        />
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--muted)]">
                        <div>
                          <dt>出現次數</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {symptom.occurrenceCount}
                          </dd>
                        </div>
                        <div>
                          <dt>平均嚴重度</dt>
                          <dd className="mt-1 font-medium text-[var(--foreground)]">
                            {symptom.avgSeverity ?? '—'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
