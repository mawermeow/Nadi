export type FieldVariant = 'default' | 'symptom';

export const fieldBaseClassName =
  'min-h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none transition';

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
