import type { ComponentPropsWithoutRef } from 'react';

import {
  getFieldClassName,
  type FieldVariant,
} from '@/components/forms/field-styles';

type TextInputProps = ComponentPropsWithoutRef<'input'> & {
  variant?: FieldVariant;
};

export function TextInput({
  variant = 'default',
  className,
  ...props
}: TextInputProps) {
  return (
    <input className={getFieldClassName(variant, className)} {...props} />
  );
}
