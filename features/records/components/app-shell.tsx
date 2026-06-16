'use client';

import type { ReactNode } from 'react';

import { BottomTabNav, type AppTabItem } from '@/features/records/components/bottom-tab-nav';
import { SidebarNav } from '@/features/records/components/sidebar-nav';

type AppShellProps = {
  activeTab: string;
  children: ReactNode;
  sidebarSyncSummary?: {
    statusLabel: string;
    pendingCount: number;
    failedCount: number;
    conflictCount: number;
    lastSyncAt: string;
  };
  tabs: AppTabItem[];
  onTabChange: (tabId: string) => void;
};

export function AppShell({
  activeTab,
  children,
  sidebarSyncSummary,
  tabs,
  onTabChange,
}: AppShellProps) {
  return (
    <main className="min-h-screen max-w-full overflow-x-clip [--mobile-bottom-nav-height:6.25rem] px-3 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+var(--mobile-bottom-nav-height))] sm:px-5 sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:pb-8 lg:h-screen lg:overflow-hidden lg:px-6 lg:pt-8 lg:pb-6">
      <div className="mx-auto flex w-full max-w-7xl gap-6 lg:h-full lg:min-h-0 lg:items-stretch">
        <SidebarNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          syncSummary={sidebarSyncSummary}
          tabs={tabs}
        />

        <div
          id="record-dashboard-scroll-container"
          className="grid min-h-0 min-w-0 flex-1 gap-6 overflow-x-clip pb-7 sm:pb-20 lg:h-full lg:overflow-y-auto lg:pb-0"
        >
          {children}
        </div>
      </div>

      <BottomTabNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabs={tabs}
      />
    </main>
  );
}
