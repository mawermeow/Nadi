'use client';

import type { AppTabItem } from '@/features/records/components/bottom-tab-nav';
import { AppTabIcon } from '@/components/ui/icons';
import {
  formatSyncQueueSummary,
  sectionCopy,
} from '@/lib/ui/section-copy';

type SidebarNavProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userGreeting?: string;
  syncSummary?: {
    statusLabel: string;
    pendingCount: number;
    failedCount: number;
    conflictCount: number;
    lastSyncAt: string;
  };
  tabs: AppTabItem[];
};

export function SidebarNav({
  activeTab,
  onTabChange,
  userGreeting,
  syncSummary,
  tabs,
}: SidebarNavProps) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white/88 p-5 backdrop-blur lg:flex lg:h-full lg:min-h-0">
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Nadi
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {sectionCopy.appHeadline}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {sectionCopy.appTagline}
        </p>
      </div>

      <nav className="mt-8 grid shrink-0 gap-2">
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
              <AppTabIcon name={tab.icon} size={20} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {userGreeting || syncSummary ? (
        <div className="mt-auto grid shrink-0 gap-4">
          {userGreeting ? (
            <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/72 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Account
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                {userGreeting}
              </p>
            </section>
          ) : null}

          {syncSummary ? (
            <section className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Sync
              </p>
              <p className="mt-2 text-sm font-medium">{syncSummary.statusLabel}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {formatSyncQueueSummary(syncSummary)}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                上次同步：{syncSummary.lastSyncAt}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
