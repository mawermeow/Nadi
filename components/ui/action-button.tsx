import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ActionButtonVariant = 'primary' | 'secondary' | 'symptom';

const variantClassName: Record<ActionButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white hover:brightness-95 disabled:opacity-60',
  secondary:
    'border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-stone-50 disabled:opacity-60',
  symptom:
    'bg-rose-500 text-white hover:brightness-95 disabled:opacity-60',
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: ActionButtonVariant;
  iconOnly?: boolean;
  fullWidth?: boolean;
};

export function ActionButton({
  icon,
  label,
  variant = 'primary',
  iconOnly = false,
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  ...props
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary';

  return (
    <button
      type={type}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      disabled={disabled}
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed',
        isSecondary ? 'font-medium' : '',
        fullWidth ? 'w-full' : '',
        variantClassName[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon}
      {iconOnly ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
