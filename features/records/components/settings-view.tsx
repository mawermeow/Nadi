'use client';

import type { ReactNode } from 'react';

type SettingsViewProps = {
  itemManagement: ReactNode;
  syncStatus?: ReactNode;
};

export function SettingsView({
  itemManagement,
  syncStatus,
}: SettingsViewProps) {
  return (
    <div className="grid gap-6">
      {syncStatus}
      {itemManagement}
    </div>
  );
}
