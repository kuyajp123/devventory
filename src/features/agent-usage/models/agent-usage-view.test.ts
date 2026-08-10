import { describe, expect, it } from 'vitest';
import type { AgentAccount, AgentQuota } from './agent-usage';
import { accountQuotaSummary } from './agent-usage-view';

describe('accountQuotaSummary', () => {
  it('displays Available window in Availability summary while account status is EXHAUSTED', () => {
    const account: AgentAccount = {
      availability: 'exhausted',
      createdAt: '2026-08-08T00:00:00Z',
      customPlatform: null,
      defaultTimezone: 'Asia/Manila',
      id: 'acc-1',
      identifier: 'johnpaulnaag10@gmail.com',
      nextResetAt: '2026-08-16T11:53:00Z',
      platform: 'antigravity',
      quotas: [
        makeQuota('q-1', 'claude and gpt models', 'exhausted', 0),
        makeQuota('q-2', 'gemini models - weekly', 'available', 83),
      ],
      signInMethod: 'google',
      trackingMode: 'manual',
      updatedAt: '2026-08-08T00:00:00Z',
    };

    const summary = accountQuotaSummary(account);
    expect(summary.hasActionableWindows).toBe(true);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toEqual({
      id: 'q-2',
      label: 'gemini models - weekly',
      remainingText: '83% remaining',
      status: 'available',
    });
  });

  it('displays ResetSoon window when paired with an Exhausted window', () => {
    const account: AgentAccount = {
      availability: 'exhausted',
      createdAt: '2026-08-08T00:00:00Z',
      customPlatform: null,
      defaultTimezone: 'Asia/Manila',
      id: 'acc-2',
      identifier: 'user@example.com',
      nextResetAt: '2026-08-14T07:00:00Z',
      platform: 'codex',
      quotas: [
        makeQuota('q-1', 'Daily limit', 'exhausted', 0),
        makeQuota('q-2', 'Monthly credits', 'resetSoon', 15),
      ],
      signInMethod: 'google',
      trackingMode: 'manual',
      updatedAt: '2026-08-08T00:00:00Z',
    };

    const summary = accountQuotaSummary(account);
    expect(summary.hasActionableWindows).toBe(true);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].label).toBe('Monthly credits');
    expect(summary.items[0].status).toBe('resetSoon');
  });

  it('orders multiple actionable windows deterministically: Available first, then ResetSoon', () => {
    const account: AgentAccount = {
      availability: 'exhausted',
      createdAt: '2026-08-08T00:00:00Z',
      customPlatform: null,
      defaultTimezone: 'Asia/Manila',
      id: 'acc-3',
      identifier: 'user@example.com',
      nextResetAt: '2026-08-14T07:00:00Z',
      platform: 'codex',
      quotas: [
        makeQuota('q-1', 'Resetting soon window', 'resetSoon', 10),
        makeQuota('q-2', 'Exhausted window', 'exhausted', 0),
        makeQuota('q-3', 'Available window', 'available', 90),
      ],
      signInMethod: 'google',
      trackingMode: 'manual',
      updatedAt: '2026-08-08T00:00:00Z',
    };

    const summary = accountQuotaSummary(account);
    expect(summary.hasActionableWindows).toBe(true);
    expect(summary.items).toHaveLength(2);
    expect(summary.items[0].label).toBe('Available window');
    expect(summary.items[1].label).toBe('Resetting soon window');
  });

  it('returns No available windows fallback when all windows are exhausted or unavailable', () => {
    const account: AgentAccount = {
      availability: 'exhausted',
      createdAt: '2026-08-08T00:00:00Z',
      customPlatform: null,
      defaultTimezone: 'Asia/Manila',
      id: 'acc-4',
      identifier: 'user@example.com',
      nextResetAt: '2026-08-14T07:00:00Z',
      platform: 'codex',
      quotas: [
        makeQuota('q-1', 'Window 1', 'exhausted', 0),
        makeQuota('q-2', 'Window 2', 'limited', 15),
      ],
      signInMethod: 'google',
      trackingMode: 'manual',
      updatedAt: '2026-08-08T00:00:00Z',
    };

    const summary = accountQuotaSummary(account);
    expect(summary.hasActionableWindows).toBe(false);
    expect(summary.label).toBe('No available windows');
  });
});

function makeQuota(
  id: string,
  label: string,
  status: 'available' | 'resetSoon' | 'exhausted' | 'limited' | 'unknown',
  remainingPercent: number | null,
): AgentQuota {
  return {
    accountId: 'acc-1',
    createdAt: '2026-08-08T00:00:00Z',
    id,
    label,
    remainingPercent,
    reminders: {
      oneDayBefore: true,
      resetDay: true,
      resetReached: true,
    },
    resetAt: '2026-08-14T07:00:00Z',
    resetReachedAt: status === 'available' ? '2026-08-14T07:00:00Z' : null,
    resetTiming: status === 'resetSoon' ? 'today' : 'future',
    status,
    timezone: 'Asia/Manila',
    trackingSource: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
    usageIsStale: false,
    usageUpdatedAt: '2026-08-08T00:00:00Z',
  };
}
