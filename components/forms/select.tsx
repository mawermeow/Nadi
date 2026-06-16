import type { ComponentPropsWithoutRef } from 'react';

import {
  getFieldClassName,
  selectAppearanceClassName,
  type FieldVariant,
} from '@/components/forms/field-styles';

type SelectProps = ComponentPropsWithoutRef<'select'> & {
  variant?: FieldVariant;
};

export function Select({
  variant = 'default',
  className,
  ...props
}: SelectProps) {
  return (
    <select
      className={getFieldClassName(
        variant,
        [selectAppearanceClassName, className].filter(Boolean).join(' '),
      )}
      {...props}
    />
  );
}
