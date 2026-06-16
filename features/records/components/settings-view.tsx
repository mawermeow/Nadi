'use client';

import type { ReactNode } from 'react';

type SettingsViewProps = {
  accountManagement?: ReactNode;
  itemManagement: ReactNode;
  syncStatus?: ReactNode;
};

export function SettingsView({
  accountManagement,
  itemManagement,
  syncStatus,
}: SettingsViewProps) {
  return (
    <div className="grid gap-6">
      {accountManagement}
      {syncStatus}
      {itemManagement}
    </div>
  );
}
