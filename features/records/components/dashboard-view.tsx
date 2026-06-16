'use client';

import type { ReactNode } from 'react';

type DashboardViewProps = {
  recentRecords: ReactNode;
  stats: ReactNode;
  userEmail: string;
};

export function DashboardView({
  recentRecords,
  stats,
  userEmail,
}: DashboardViewProps) {
  return (
    <div className="grid gap-6 sm:gap-7 lg:gap-8">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_24px_80px_rgba(31,42,42,0.08)] sm:p-6 lg:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Dashboard
        </p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="max-w-[12ch] text-[2rem] leading-[1.05] font-semibold tracking-tight sm:max-w-none sm:text-[2.5rem]">
              觀察自己的日常訊號
            </h2>
          </div>
          <div className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--muted)] sm:w-auto">
            目前使用者：{userEmail}
          </div>
        </div>

        <div className="mt-6">{stats}</div>
      </section>

      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
        <div>
          <h3 className="text-xl font-semibold">最近紀錄</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            只保留最近幾筆，方便快速回頭確認。
          </p>
        </div>
        <div className="mt-4">{recentRecords}</div>
      </section>
    </div>
  );
}
