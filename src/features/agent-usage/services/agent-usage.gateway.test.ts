import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { agentUsageGateway } from './agent-usage.gateway';

describe('agentUsageGateway', () => {
  it('uses a global account query without a project identifier', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('list_agent_accounts');
      expect(args).toEqual({});
      return [];
    });

    await expect(agentUsageGateway.listAccounts()).resolves.toEqual([]);
  });

  it('sends only confirmed reset data when saving a manual quota', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('save_agent_quota');
      expect(args).toEqual({
        input: {
          accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
          label: 'Weekly',
          remainingPercent: null,
          reminders: {
            beforeResetHours: 24,
            resetDay: true,
            resetReached: true,
          },
          resetAt: '2026-08-14T07:00:00Z',
          timezone: 'Asia/Manila',
          trackingSource: 'manual',
        },
      });
      return quotaResponse();
    });

    await expect(
      agentUsageGateway.saveQuota({
        accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        label: 'Weekly',
        remainingPercent: null,
        reminders: {
          beforeResetHours: 24,
          resetDay: true,
          resetReached: true,
        },
        resetAt: '2026-08-14T07:00:00Z',
        timezone: 'Asia/Manila',
        trackingSource: 'manual',
      }),
    ).resolves.toMatchObject({ label: 'Weekly', remainingPercent: null });
  });
});

function quotaResponse() {
  return {
    accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    createdAt: '2026-08-08T00:00:00Z',
    id: 'e49c4e06-a95f-481d-a456-9dd066591067',
    label: 'Weekly',
    remainingPercent: null,
    reminders: {
      beforeResetHours: 24,
      resetDay: true,
      resetReached: true,
    },
    resetAt: '2026-08-14T07:00:00Z',
    resetReachedAt: null,
    resetTiming: 'future',
    status: 'unknown',
    timezone: 'Asia/Manila',
    trackingSource: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
    usageIsStale: false,
    usageUpdatedAt: null,
  };
}
