'use client';

import type { ReactNode } from 'react';

type ReportsViewProps = {
  correlation: ReactNode;
  summary: ReactNode;
};

export function ReportsView({ correlation, summary }: ReportsViewProps) {
  return (
    <div className="grid gap-6">
      {summary}
      {correlation}
    </div>
  );
}
