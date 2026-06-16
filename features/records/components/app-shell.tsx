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
    <main className="min-h-screen px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] sm:px-5 sm:py-6 sm:pb-8 lg:h-screen lg:overflow-hidden lg:px-6 lg:py-8 lg:pb-6">
      <div className="mx-auto flex w-full max-w-7xl gap-6 lg:h-full">
        <SidebarNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          syncSummary={sidebarSyncSummary}
          tabs={tabs}
        />

        <div className="grid min-w-0 flex-1 gap-6 pb-7 sm:gap-7 sm:pb-20 lg:h-full lg:gap-8 lg:overflow-y-auto lg:pb-0">
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
