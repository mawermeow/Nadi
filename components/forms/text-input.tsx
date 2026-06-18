import type { ComponentPropsWithoutRef } from 'react';

import {
  getFieldClassName,
  getTemporalFieldClassName,
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
  const isTemporalInput = type ? temporalInputTypes.has(type) : false;

  return (
    <input
      className={
        isTemporalInput
          ? getTemporalFieldClassName(variant, className)
          : getFieldClassName(variant, className)
      }
      type={type}
      {...props}
    />
  );
}
