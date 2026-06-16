'use client';

import type { ReactNode } from 'react';

import { BottomTabNav, type AppTabItem } from '@/features/records/components/bottom-tab-nav';
import { SidebarNav } from '@/features/records/components/sidebar-nav';

type AppShellProps = {
  activeTab: string;
  children: ReactNode;
  tabs: AppTabItem[];
  onTabChange: (tabId: string) => void;
};

export function AppShell({
  activeTab,
  children,
  tabs,
  onTabChange,
}: AppShellProps) {
  return (
    <main className="min-h-screen px-3 py-4 pb-28 sm:px-5 sm:py-6 sm:pb-8 lg:px-6 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl gap-6">
        <SidebarNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          tabs={tabs}
        />

        <div className="grid min-w-0 flex-1 gap-6 pb-6 sm:gap-7 lg:gap-8">
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
