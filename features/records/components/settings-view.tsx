'use client';

import type { ReactNode } from 'react';

type SettingsViewProps = {
  accountManagement?: ReactNode;
  ownershipManagement?: ReactNode;
  itemManagement: ReactNode;
  syncStatus?: ReactNode;
};

export function SettingsView({
  accountManagement,
  ownershipManagement,
  itemManagement,
  syncStatus,
}: SettingsViewProps) {
  return (
    <div className="grid gap-6">
      {accountManagement}
      {ownershipManagement}
      {syncStatus}
      {itemManagement}
    </div>
  );
}
