import { AppError } from '@/lib/validation/errors';

export function normalizeRange(from: Date, to: Date) {
  if (from > to) {
    throw new AppError('結束時間必須晚於開始時間', 400, 'INVALID_DATE_RANGE');
  }

  return {
    from,
    to,
  };
}
