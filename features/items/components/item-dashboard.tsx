'use client';

import { useMemo, useState, useTransition } from 'react';

import type { ItemResponse } from '@/features/items/api';

type ItemDashboardProps = {
  initialItems: ItemResponse[];
  userEmail: string;
};

type FormState = {
  title: string;
  type: 'metric' | 'symptom';
  valueType: 'number' | 'boolean' | 'scale' | 'text';
  unit: string;
  scaleMin: string;
  scaleMax: string;
};

const defaultFormState: FormState = {
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

type ApiFieldErrors = Record<string, string[] | undefined>;

export function ItemDashboard({
  initialItems,
  userEmail,
}: ItemDashboardProps) {
  const [items, setItems] = useState(initialItems);
  const [showArchived, setShowArchived] = useState(false);
  const [formState, setFormState] = useState(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const activeItems = useMemo(
    () => items.filter((item) => !item.archived),
    [items],
  );
  const archivedItems = useMemo(
    () => items.filter((item) => item.archived),
    [items],
  );

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      title: formState.title,
      type: formState.type,
      valueType: formState.valueType,
      unit: formState.unit,
      scaleMin: formState.valueType === 'scale' ? formState.scaleMin : undefined,
      scaleMax: formState.valueType === 'scale' ? formState.scaleMax : undefined,
    };

    startSubmitTransition(async () => {
      const response = await fetch('/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error?.message ?? '建立項目失敗');
        setFieldErrors(data.error?.fieldErrors ?? {});
        return;
      }

      setItems((currentItems) => [data, ...currentItems]);
      setFormState(defaultFormState);
    });
  }

  function updateFormValue<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  async function toggleArchive(item: ItemResponse, archived: boolean) {
    startMutateTransition(async () => {
      const response = await fetch(`/v1/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archived,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error?.message ?? '更新項目失敗');
        return;
      }

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id ? data : currentItem,
        ),
      );
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(31,42,42,0.08)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Nadi / Phase 2
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                建立你的追蹤項目
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                先從最常記錄的項目開始。預設只顯示啟用中的項目，已封存項目可另外展開查看。
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)]">
              目前使用者：{userEmail}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={handleCreateItem}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">新增項目</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  流程盡量保持簡單，先建立，再慢慢調整。
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium">項目名稱</span>
                <input
                  value={formState.title}
                  onChange={(event) => updateFormValue('title', event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none ring-0 transition focus:border-[var(--accent)]"
                  placeholder="例如：睡眠、喝水、頭痛"
                />
                {fieldErrors.title?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {fieldErrors.title[0]}
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
                      onClick={() => updateFormValue('type', option.value)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        formState.type === option.value
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
                  value={formState.valueType}
                  onChange={(event) =>
                    updateFormValue(
                      'valueType',
                      event.target.value as FormState['valueType'],
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
                {fieldErrors.valueType?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {fieldErrors.valueType[0]}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">單位</span>
                <input
                  value={formState.unit}
                  onChange={(event) => updateFormValue('unit', event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                  placeholder="例如：小時、杯、次"
                />
                {fieldErrors.unit?.[0] ? (
                  <span className="text-sm text-rose-700">
                    {fieldErrors.unit[0]}
                  </span>
                ) : null}
              </label>

              {formState.valueType === 'scale' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">量表最小值</span>
                    <input
                      inputMode="numeric"
                      value={formState.scaleMin}
                      onChange={(event) =>
                        updateFormValue('scaleMin', event.target.value)
                      }
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                      placeholder="0"
                    />
                    {fieldErrors.scaleMin?.[0] ? (
                      <span className="text-sm text-rose-700">
                        {fieldErrors.scaleMin[0]}
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">量表最大值</span>
                    <input
                      inputMode="numeric"
                      value={formState.scaleMax}
                      onChange={(event) =>
                        updateFormValue('scaleMax', event.target.value)
                      }
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--accent)]"
                      placeholder="10"
                    />
                    {fieldErrors.scaleMax?.[0] ? (
                      <span className="text-sm text-rose-700">
                        {fieldErrors.scaleMax[0]}
                      </span>
                    ) : null}
                  </label>
                </div>
              ) : null}
            </div>

            {formError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? '建立中…' : '建立項目'}
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
                          格式：{valueTypeOptions.find((option) => option.value === item.valueType)?.label}
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
                        disabled={isMutating}
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
                              {valueTypeOptions.find((option) => option.value === item.valueType)?.label}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleArchive(item, false)}
                            disabled={isMutating}
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
