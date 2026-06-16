'use client';

import type { AppTabItem } from '@/features/records/components/bottom-tab-nav';

type SidebarNavProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: AppTabItem[];
};

export function SidebarNav({
  activeTab,
  onTabChange,
  tabs,
}: SidebarNavProps) {
  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white/88 p-5 shadow-[0_18px_48px_rgba(31,42,42,0.08)] backdrop-blur lg:block">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Nadi
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Observe yourself
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          以工具型 App 的節奏整理日常訊號，先記錄，再回頭閱讀。
        </p>
      </div>

      <nav className="mt-8 grid gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(45,106,90,0.2)]'
                  : 'bg-[var(--surface)] text-[var(--foreground)]'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
