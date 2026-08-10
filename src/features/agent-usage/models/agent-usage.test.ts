import { describe, expect, it } from 'vitest';
import {
  agentAccountFormSchema,
  agentAccountSchema,
  agentQuotaFormSchema,
} from './agent-usage';

describe('Agent Usage contracts', () => {
  it('accepts a global account with multiple quota windows and a full identifier', () => {
    const parsed = agentAccountSchema.parse({
      availability: 'exhausted',
      createdAt: '2026-08-08T00:00:00Z',
      customPlatform: null,
      defaultTimezone: 'Asia/Manila',
      id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      identifier: 'paul+codex@example.com',
      nextResetAt: '2026-08-14T07:00:00Z',
      platform: 'codex',
      quotas: [quota('5-hour', 'available'), quota('Weekly', 'exhausted')],
      signInMethod: 'google',
      trackingMode: 'manual',
      updatedAt: '2026-08-08T00:00:00Z',
    });

    expect(parsed.identifier).toBe('paul+codex@example.com');
    expect(parsed.quotas).toHaveLength(2);
  });

  it('requires a custom provider label and allows usage to remain unknown', () => {
    expect(
      agentAccountFormSchema.safeParse({
        customPlatform: '',
        defaultTimezone: 'Asia/Manila',
        identifier: 'developer@example.com',
        platform: 'custom',
        signInMethod: 'email',
        trackingMode: 'manual',
      }).success,
    ).toBe(false);

    expect(
      agentQuotaFormSchema.parse({
        customBeforeHours: '24',
        label: 'Weekly',
        remainingPercent: '',
        remindCustomBefore: true,
        remindResetDay: true,
        remindResetReached: true,
        timezone: 'Asia/Manila',
      }).remainingPercent,
    ).toBe('');
  });
});

function quota(label: string, status: string) {
  return {
    accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    createdAt: '2026-08-08T00:00:00Z',
    id: crypto.randomUUID(),
    label,
    remainingPercent: status === 'available' ? null : 0,
    reminders: {
      beforeResetHours: 24,
      resetDay: true,
      resetReached: true,
    },
    resetAt: '2026-08-14T07:00:00Z',
    resetReachedAt: status === 'available' ? '2026-08-14T07:00:00Z' : null,
    resetTiming: status === 'available' ? 'elapsed' : 'future',
    status,
    timezone: 'Asia/Manila',
    trackingSource: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
    usageIsStale: status === 'available',
    usageUpdatedAt: null,
  };
}
