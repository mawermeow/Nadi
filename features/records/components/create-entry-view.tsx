'use client';

import type { ReactNode } from 'react';

type CreateEntryViewProps = {
  itemForm: ReactNode;
  recordForm: ReactNode;
};

export function CreateEntryView({
  itemForm,
  recordForm,
}: CreateEntryViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-6">
      {recordForm}
      {itemForm}
    </div>
  );
}
