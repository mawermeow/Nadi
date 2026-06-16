'use client';

import type { ReactNode } from 'react';

type RecordsListViewProps = {
  children: ReactNode;
};

export function RecordsListView({ children }: RecordsListViewProps) {
  return <div className="grid gap-6">{children}</div>;
}
