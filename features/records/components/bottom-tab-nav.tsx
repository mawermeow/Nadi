'use client';

import { AppTabIcon, type AppTabIconName } from '@/components/ui/icons';

export type AppTabItem = {
  id: string;
  label: string;
  mobileLabel: string;
  icon: AppTabIconName;
};

type BottomTabNavProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: AppTabItem[];
};

export function BottomTabNav({
  activeTab,
  onTabChange,
  tabs,
}: BottomTabNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/94 px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(45,106,90,0.2)]'
                  : 'bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              <AppTabIcon name={tab.icon} size={18} />
              <span className="mt-1 text-[11px] font-medium leading-none">
                {tab.mobileLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
