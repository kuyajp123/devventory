import { z } from 'zod';

export const unreadReminderStateSchema = z
  .object({
    count: z.number().int().nonnegative(),
    pulse: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export type UnreadReminderState = z.infer<typeof unreadReminderStateSchema>;
