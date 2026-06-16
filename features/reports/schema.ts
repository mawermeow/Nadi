import { z } from 'zod';

export function createSummaryReportQuerySchema(maxRangeDays: number) {
  return z
    .object({
      from: z
        .string()
        .datetime({ offset: true, message: '請提供有效的開始時間' }),
      to: z
        .string()
        .datetime({ offset: true, message: '請提供有效的結束時間' }),
    })
    .superRefine((value, context) => {
      const from = new Date(value.from);
      const to = new Date(value.to);

      if (from > to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: '結束時間必須晚於開始時間',
        });
        return;
      }

      const maxRangeMs = maxRangeDays * 24 * 60 * 60 * 1000;

      if (to.getTime() - from.getTime() > maxRangeMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['to'],
          message: `查詢範圍不可超過 ${maxRangeDays} 天`,
        });
      }
    });
}

export type SummaryReportQueryInput = {
  from: string;
  to: string;
};
