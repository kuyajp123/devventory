import { z } from 'zod';

export const agentPlatformSchema = z.enum([
  'codex',
  'claude_code',
  'devin',
  'github_copilot',
  'cursor',
  'kiro',
  'antigravity',
  'gemini_cli',
  'windsurf',
  'custom',
]);
export type AgentPlatform = z.infer<typeof agentPlatformSchema>;

export const signInMethodSchema = z.enum([
  'google',
  'github',
  'microsoft',
  'apple',
  'email',
  'phone',
  'organization_sso',
  'other',
]);
export type SignInMethod = z.infer<typeof signInMethodSchema>;

export const trackingModeSchema = z.enum(['manual', 'automaticConnector']);
export const trackingSourceSchema = z.enum([
  'manual',
  'pasted',
  'automaticConnector',
]);
export const agentAvailabilitySchema = z.enum([
  'available',
  'limited',
  'exhausted',
  'resetSoon',
  'unknown',
]);
export type AgentAvailability = z.infer<typeof agentAvailabilitySchema>;

export const reminderPreferencesSchema = z
  .object({
    beforeResetHours: z.number().int().min(1).max(720).nullable(),
    resetDay: z.boolean(),
    resetReached: z.boolean(),
  })
  .strict();

export const agentQuotaSchema = z
  .object({
    accountId: z.string().uuid(),
    createdAt: z.string().min(1),
    id: z.string().uuid(),
    label: z.string().min(1).max(80),
    remainingPercent: z.number().min(0).max(100).nullable(),
    reminders: reminderPreferencesSchema,
    resetAt: z.string().min(1),
    resetReachedAt: z.string().nullable(),
    resetTiming: z.enum(['today', 'tomorrow', 'future', 'elapsed']),
    status: agentAvailabilitySchema,
    timezone: z.string().min(1).max(100),
    trackingSource: trackingSourceSchema,
    updatedAt: z.string().min(1),
    usageIsStale: z.boolean(),
    usageUpdatedAt: z.string().nullable(),
  })
  .strict();
export type AgentQuota = z.infer<typeof agentQuotaSchema>;

export const agentAccountSchema = z
  .object({
    availability: agentAvailabilitySchema,
    createdAt: z.string().min(1),
    customPlatform: z.string().min(1).max(80).nullable(),
    defaultTimezone: z.string().min(1).max(100),
    id: z.string().uuid(),
    identifier: z.string().min(1).max(320),
    nextResetAt: z.string().nullable(),
    platform: agentPlatformSchema,
    quotas: z.array(agentQuotaSchema),
    signInMethod: signInMethodSchema,
    trackingMode: trackingModeSchema,
    updatedAt: z.string().min(1),
  })
  .strict();
export type AgentAccount = z.infer<typeof agentAccountSchema>;

export const agentReminderSchema = z
  .object({
    accountId: z.string().uuid(),
    customPlatform: z.string().nullable(),
    id: z.string().uuid(),
    identifier: z.string().min(1),
    kind: z.enum(['beforeReset', 'resetDay', 'resetReached']),
    platform: agentPlatformSchema,
    quotaLabel: z.string().min(1),
    quotaWindowId: z.string().uuid(),
    resetAt: z.string().min(1),
    scheduledFor: z.string().min(1),
  })
  .strict();
export type AgentReminder = z.infer<typeof agentReminderSchema>;

export const reminderBatchSchema = z
  .object({
    batchToken: z.string().uuid(),
    reminders: agentReminderSchema.array(),
  })
  .strict();
export type ReminderBatch = z.infer<typeof reminderBatchSchema>;

export const inAppDeliveryPayloadSchema = z
  .object({
    batch: reminderBatchSchema,
    dispatchId: z.string().uuid(),
  })
  .strict();

export const notificationNavigationIntentSchema = z.discriminatedUnion('type', [
  z
    .object({
      accountId: z.string().uuid(),
      quotaWindowId: z.string().uuid(),
      type: z.literal('individual'),
    })
    .strict(),
  z.object({ type: z.literal('burst') }).strict(),
]);

export type ReminderOutcome =
  | { id: string; status: 'delivered' }
  | { id: string; status: 'suppressed'; reason?: string }
  | { id: string; status: 'failed'; error?: string };

export const agentAccountFormSchema = z
  .object({
    customPlatform: z.string().trim().max(80),
    defaultTimezone: z.string().trim().min(1, 'Select a timezone.'),
    identifier: z
      .string()
      .trim()
      .min(1, 'Enter the full account identifier.')
      .max(320),
    platform: agentPlatformSchema,
    signInMethod: signInMethodSchema,
    trackingMode: z.literal('manual'),
  })
  .superRefine((value, context) => {
    if (value.platform === 'custom' && !value.customPlatform.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Enter the coding-agent platform name.',
        path: ['customPlatform'],
      });
    }
  });
export type AgentAccountFormValues = z.infer<typeof agentAccountFormSchema>;

export const agentQuotaFormSchema = z
  .object({
    customBeforeHours: z.string(),
    label: z.string().trim().min(1, 'Enter a quota window label.').max(80),
    remainingPercent: z.string().refine(
      (value) => {
        if (!value.trim()) return true;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 && number <= 100;
      },
      { message: 'Enter a percentage from 0 to 100, or leave it blank.' },
    ),
    remindCustomBefore: z.boolean(),
    remindResetDay: z.boolean(),
    remindResetReached: z.boolean(),
    timezone: z.string().trim().min(1, 'Select a timezone.'),
  })
  .superRefine((values, context) => {
    if (values.remindCustomBefore) {
      const hours = Number(values.customBeforeHours.trim());
      if (
        !values.customBeforeHours.trim() ||
        !Number.isInteger(hours) ||
        hours < 1 ||
        hours > 720
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Enter hours from 1 to 720 (up to 30 days).',
          path: ['customBeforeHours'],
        });
      }
    }
  });
export type AgentQuotaFormValues = z.infer<typeof agentQuotaFormSchema>;

export interface SaveAgentAccountInput extends AgentAccountFormValues {
  id?: string;
}

export interface SaveAgentQuotaInput {
  accountId: string;
  id?: string;
  label: string;
  remainingPercent: number | null;
  reminders: {
    beforeResetHours: number | null;
    resetDay: boolean;
    resetReached: boolean;
  };
  resetAt: string;
  timezone: string;
  trackingSource: 'manual' | 'pasted';
}

export interface AgentQuotaSaveError {
  field: 'form' | 'label';
  message: string;
}

export const PLATFORM_LABELS: Record<AgentPlatform, string> = {
  antigravity: 'Antigravity',
  claude_code: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  custom: 'Other / Custom',
  devin: 'Devin',
  gemini_cli: 'Gemini CLI',
  github_copilot: 'GitHub Copilot',
  kiro: 'Kiro',
  windsurf: 'Windsurf',
};

export const SIGN_IN_METHOD_LABELS: Record<SignInMethod, string> = {
  apple: 'Apple',
  email: 'Email',
  github: 'GitHub',
  google: 'Google',
  microsoft: 'Microsoft',
  organization_sso: 'Organization / SSO',
  other: 'Other',
  phone: 'Phone number',
};

export const DEFAULT_TIMEZONE = 'Asia/Manila';
export const TIMEZONE_OPTIONS = [
  'Asia/Manila',
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;
