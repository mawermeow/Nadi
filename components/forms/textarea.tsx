import type { ComponentPropsWithoutRef } from 'react';

import {
  getFieldClassName,
  type FieldVariant,
} from '@/components/forms/field-styles';

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  variant?: FieldVariant;
};

export function Textarea({
  variant = 'default',
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea className={getFieldClassName(variant, className)} {...props} />
  );
}
