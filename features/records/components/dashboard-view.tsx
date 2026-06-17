'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { sectionCopy } from '@/lib/ui/section-copy';

type DashboardViewProps = {
  recentRecords: ReactNode;
  stats: ReactNode;
  userGreeting?: string;
};

export function DashboardView({
  recentRecords,
  stats,
  userGreeting,
}: DashboardViewProps) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6 lg:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          Dashboard
        </p>
        <div className="flex lg:hidden">
          <div className="flex h-24 w-24 items-center justify-center self-start">
            <Image
              src="/logo/nadi-logo.png"
              alt="Nadi logo"
              width={72}
              height={72}
              className="h-16 w-16 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
              priority
            />
          </div>
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <h2 className="max-w-[12ch] text-[2rem] leading-[1.05] font-semibold tracking-tight sm:max-w-none sm:text-[2.5rem]">
                Nadi
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {sectionCopy.appShortTagline}
              </p>
            </div>
          </div>
        </div>
        {userGreeting ? (
          <p className="mt-4 text-2xl font-semibold tracking-tight lg:mt-3">
            {userGreeting}
          </p>
        ) : null}

        <div className="mt-5 lg:mt-4">{stats}</div>
      </section>

      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
        <div>
          <h3 className="text-xl font-semibold">最近紀錄</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {sectionCopy.dashboard.recentRecords}
          </p>
        </div>
        <div className="mt-5 grid gap-3">{recentRecords}</div>
      </section>
    </div>
  );
}
