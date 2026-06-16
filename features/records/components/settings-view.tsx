'use client';

import type { ReactNode } from 'react';

type SettingsViewProps = {
  itemManagement: ReactNode;
};

export function SettingsView({ itemManagement }: SettingsViewProps) {
  return (
    <div className="grid gap-4 lg:gap-6">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 shadow-[0_10px_30px_rgba(31,42,42,0.05)] backdrop-blur sm:p-5 lg:p-6">
        <h2 className="text-xl font-semibold">設定</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          目前先把項目管理放在這裡。之後若加入偏好設定、顯示選項或提醒設定，也會放在這個分頁。
        </p>
      </section>

      {itemManagement}
    </div>
  );
}
