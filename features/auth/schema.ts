import { z } from 'zod';

export const deviceLinkRequestSchema = z.object({
  deviceId: z.string().trim().min(1, '請提供 deviceId').max(120, 'deviceId 過長'),
  localItemCount: z.coerce.number().int().min(0),
  localRecordCount: z.coerce.number().int().min(0),
  pendingOperationCount: z.coerce.number().int().min(0),
  forceRelink: z.boolean().optional(),
});

export type DeviceLinkRequest = z.infer<typeof deviceLinkRequestSchema>;
