import { z } from 'zod';

function createReportRangeSchema(maxRangeDays: number) {
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

export function createSummaryReportQuerySchema(maxRangeDays: number) {
  return createReportRangeSchema(maxRangeDays);
}

export function createCorrelationReportQuerySchema(maxRangeDays: number) {
  return createReportRangeSchema(maxRangeDays).extend({
    symptomItemId: z.string().uuid('請提供有效的症狀項目'),
    windowHours: z.coerce
      .number()
      .int('請提供整數小時')
      .min(1, 'windowHours 至少為 1 小時')
      .max(168, 'windowHours 不可超過 168 小時'),
  });
}

export type SummaryReportQueryInput = {
  from: string;
  to: string;
};

export type CorrelationReportQueryInput = {
  symptomItemId: string;
  from: string;
  to: string;
  windowHours: number;
};
