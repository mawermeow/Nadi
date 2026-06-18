export type FieldVariant = 'default' | 'symptom';

const fieldShellClassName =
  'box-border min-h-12 min-w-0 max-w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none transition';

export const fieldBaseClassName = `${fieldShellClassName} w-full`;

export const temporalInputClassName = 'nadi-temporal-input';

export const temporalInputTypes = new Set([
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
]);

export const fieldVariantClassName: Record<FieldVariant, string> = {
  default: 'focus:border-[var(--accent)]',
  symptom: 'focus:border-rose-400',
};

export const selectAppearanceClassName = 'nadi-select';

export function getFieldClassName(
  variant: FieldVariant = 'default',
  className?: string,
) {
  return [fieldBaseClassName, fieldVariantClassName[variant], className]
    .filter(Boolean)
    .join(' ');
}

export function getTemporalFieldClassName(
  variant: FieldVariant = 'default',
  className?: string,
) {
  return [
    fieldShellClassName,
    temporalInputClassName,
    fieldVariantClassName[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
