import type { ComponentPropsWithoutRef } from 'react';

import {
  getFieldClassName,
  temporalInputClassName,
  temporalInputTypes,
  type FieldVariant,
} from '@/components/forms/field-styles';

type TextInputProps = ComponentPropsWithoutRef<'input'> & {
  variant?: FieldVariant;
};

export function TextInput({
  variant = 'default',
  className,
  type,
  ...props
}: TextInputProps) {
  const temporalClassName =
    type && temporalInputTypes.has(type) ? temporalInputClassName : undefined;

  return (
    <input
      className={getFieldClassName(
        variant,
        [temporalClassName, className].filter(Boolean).join(' '),
      )}
      type={type}
      {...props}
    />
  );
}
