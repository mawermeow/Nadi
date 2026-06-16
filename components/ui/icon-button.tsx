import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'danger';

const variantClassName: Record<IconButtonVariant, string> = {
  default:
    'border-[var(--line)] text-[var(--foreground)] hover:bg-stone-50',
  danger: 'border-rose-200 text-rose-700 hover:bg-rose-50',
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
};

export function IconButton({
  label,
  icon,
  variant = 'default',
  className,
  disabled,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={[
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-60',
        variantClassName[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon}
    </button>
  );
}
