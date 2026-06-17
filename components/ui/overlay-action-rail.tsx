'use client';

import type { ReactNode } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { MoreHorizontalIcon, XIcon } from '@/components/ui/icons';

type OverlayActionRailProps = {
  children: ReactNode;
  revealedActions: ReactNode;
  actionsRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  ariaLabel: string;
  className?: string;
  enabled?: boolean;
  revealedActionsLayout?: 'row' | 'col';
  maskClassName?: string;
  maskWidthClassName?: string;
};

export function OverlayActionRail({
  children,
  revealedActions,
  actionsRevealed,
  onReveal,
  onClose,
  ariaLabel,
  className,
  enabled = true,
  revealedActionsLayout = 'row',
  maskClassName = 'from-white from-65% via-white/95',
  maskWidthClassName = 'w-52 sm:w-60',
}: OverlayActionRailProps) {
  const contentClassName = [
    'min-w-0 transition-opacity duration-200 ease-out motion-reduce:transition-none',
    enabled ? 'pr-18' : '',
    enabled && actionsRevealed ? 'opacity-45' : 'opacity-100',
  ]
    .filter(Boolean)
    .join(' ');

  const asideClassName = [
    'absolute right-3.5 z-20 sm:right-4',
    actionsRevealed && revealedActionsLayout === 'col'
      ? 'inset-y-3.5 flex items-center sm:inset-y-4'
      : 'top-1/2 -translate-y-1/2',
  ].join(' ');

  const revealedActionsClassName =
    revealedActionsLayout === 'col'
      ? 'flex flex-col items-center gap-1.5'
      : 'flex items-center gap-1.5';

  return (
    <div className={['relative overflow-hidden', className].filter(Boolean).join(' ')}>
      <div className={contentClassName}>{children}</div>

      {enabled ? (
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute top-3.5 right-18 bottom-3.5 z-10 w-px bg-[var(--line)] sm:top-4 sm:bottom-4',
            'transition-opacity duration-200 ease-out motion-reduce:transition-none',
            actionsRevealed ? 'opacity-45' : 'opacity-100',
          ].join(' ')}
        />
      ) : null}

      {enabled && actionsRevealed ? (
        <div
          aria-hidden
          className={[
            'pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l to-transparent motion-safe:animate-[record-card-actions-in_200ms_ease-out]',
            maskWidthClassName,
            maskClassName,
          ].join(' ')}
        />
      ) : null}

      {enabled ? (
        <aside aria-label={ariaLabel} className={asideClassName}>
          <div className="relative min-h-11">
            <div
              className={[
                revealedActionsClassName,
                'transition-opacity duration-200 ease-out motion-reduce:transition-none',
                actionsRevealed
                  ? 'motion-safe:animate-[record-card-actions-in_200ms_ease-out] opacity-100'
                  : 'pointer-events-none absolute top-0 right-0 opacity-0',
              ].join(' ')}
            >
              {revealedActions}
              <IconButton
                label="收起操作"
                icon={<XIcon size={18} />}
                onClick={onClose}
                tabIndex={actionsRevealed ? undefined : -1}
              />
            </div>
            <IconButton
              label="更多操作"
              icon={<MoreHorizontalIcon size={18} />}
              onClick={onReveal}
              className={[
                'text-[var(--muted)] transition-opacity duration-200 ease-out motion-reduce:transition-none',
                actionsRevealed
                  ? 'pointer-events-none absolute top-0 right-0 opacity-0'
                  : 'opacity-100',
              ].join(' ')}
              tabIndex={actionsRevealed ? -1 : undefined}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
