import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { agentUsageGateway } from '../services/agent-usage.gateway';
import { AgentUsagePage } from './AgentUsagePage';

vi.mock('../services/agent-usage.gateway', () => ({
  agentUsageGateway: {
    deleteAccount: vi.fn(),
    deleteQuota: vi.fn(),
    listAccounts: vi.fn(),
    previewReset: vi.fn(),
    saveAccount: vi.fn(),
    saveQuota: vi.fn(),
    takeDueReminders: vi.fn(),
  },
}));

describe('AgentUsagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse(),
    ]);
    vi.mocked(agentUsageGateway.previewReset).mockResolvedValue({
      hadExplicitTimezone: false,
      interpretation: '2026-08-14 15:00 +08',
      method: 'pasted',
      resetAt: '2026-08-14T07:00:00Z',
      timezone: 'Asia/Manila',
    });
    vi.mocked(agentUsageGateway.saveQuota).mockResolvedValue(quotaResponse());
    vi.mocked(agentUsageGateway.deleteAccount).mockResolvedValue(undefined);
    vi.mocked(agentUsageGateway.deleteQuota).mockResolvedValue(undefined);
  });

  it('renders the full account identifier and availability without project context', async () => {
    renderWithProviders(<AgentUsagePage />);

    expect(
      await screen.findByRole('heading', { name: 'Agent Usage' }),
    ).toBeVisible();
    expect(await screen.findByText('paul+codex@example.com')).toBeVisible();
    expect(screen.getAllByText('Exhausted').length).toBeGreaterThan(0);
  });

  it('adds a manual built-in provider account with its selected sign-in method', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.saveAccount).mockResolvedValue(
      accountResponse({ identifier: 'work@example.com', quotas: [] }),
    );
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', { name: 'Add account' }),
    );
    await user.click(
      screen.getByRole('button', { name: /Coding-agent platform/ }),
    );
    await user.click(screen.getByRole('option', { name: 'Cursor' }));
    await user.click(screen.getByRole('button', { name: /Sign-in method/ }));
    await user.click(screen.getByRole('option', { name: 'GitHub' }));
    await user.type(
      screen.getByLabelText('Full account identifier'),
      'work@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Save account' }));

    await waitFor(() =>
      expect(agentUsageGateway.saveAccount).toHaveBeenCalledWith({
        customPlatform: '',
        defaultTimezone: 'Asia/Manila',
        identifier: 'work@example.com',
        platform: 'cursor',
        signInMethod: 'github',
        trackingMode: 'manual',
      }),
    );
  });

  it('supports a custom provider without enabling an unverified connector', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.saveAccount).mockResolvedValue(
      accountResponse({
        customPlatform: 'OpenCode',
        identifier: 'developer@example.com',
        platform: 'custom',
        quotas: [],
      }),
    );
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', { name: 'Add account' }),
    );
    await user.click(
      screen.getByRole('button', { name: /Coding-agent platform/ }),
    );
    await user.click(screen.getByRole('option', { name: 'Other / Custom' }));
    await user.type(screen.getByLabelText('Custom platform name'), 'OpenCode');
    await user.type(
      screen.getByLabelText('Full account identifier'),
      'developer@example.com',
    );
    expect(screen.getByText('Manual tracking')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save account' }));

    await waitFor(() =>
      expect(agentUsageGateway.saveAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          customPlatform: 'OpenCode',
          identifier: 'developer@example.com',
          platform: 'custom',
          trackingMode: 'manual',
        }),
      ),
    );
  });

  it('edits and deletes accounts through explicit actions', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.saveAccount).mockResolvedValue(
      accountResponse({ identifier: 'updated@example.com' }),
    );
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Edit account paul+codex@example.com',
      }),
    );
    const identifier = screen.getByLabelText('Full account identifier');
    await user.clear(identifier);
    await user.type(identifier, 'updated@example.com');
    await user.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() =>
      expect(agentUsageGateway.saveAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
          identifier: 'updated@example.com',
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Delete account paul+codex@example.com',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(agentUsageGateway.deleteAccount).toHaveBeenCalledWith(
        '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      ),
    );
  });

  it('requires confirmation before saving a deterministically parsed reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Paste message' }));
    await user.type(
      screen.getByLabelText('Provider reset message'),
      'Your limit resets Friday at 3:00 PM',
    );
    expect(screen.getByRole('button', { name: 'Save quota' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Preview reset' }));
    expect(await screen.findByText('2026-08-14 15:00 +08')).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I confirm this interpreted reset time',
      }),
    );
    const saveButton = screen.getByRole('button', { name: 'Save quota' });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() =>
      expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
          label: 'Weekly',
          remainingPercent: null,
          resetAt: '2026-08-14T07:00:00Z',
          timezone: 'Asia/Manila',
          trackingSource: 'pasted',
        }),
      ),
    );
  });

  it('previews exact and normalized relative reset inputs in the account timezone', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Preview reset' }));
    await waitFor(() =>
      expect(agentUsageGateway.previewReset).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'exact',
          time: '09:00',
          timezone: 'Asia/Manila',
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Reset in' }));
    await user.clear(screen.getByLabelText('Days'));
    await user.type(screen.getByLabelText('Days'), '6');
    await user.clear(screen.getByLabelText('Hours'));
    await user.type(screen.getByLabelText('Hours'), '24');
    await user.click(screen.getByRole('button', { name: 'Preview reset' }));
    await waitFor(() =>
      expect(agentUsageGateway.previewReset).toHaveBeenLastCalledWith({
        days: 6,
        hours: 24,
        method: 'relative',
        minutes: 0,
        timezone: 'Asia/Manila',
      }),
    );
  });

  it('edits and removes quota windows without requiring usage percentage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AgentUsagePage />);

    await user.click(
      await screen.findByRole('button', {
        name: 'Edit Weekly quota for paul+codex@example.com',
      }),
    );
    await user.clear(screen.getByLabelText('Usage remaining (optional %)'));
    await user.click(screen.getByRole('button', { name: 'Save quota' }));
    await waitFor(() =>
      expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'e49c4e06-a95f-481d-a456-9dd066591067',
          remainingPercent: null,
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Remove Weekly quota for paul+codex@example.com',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(agentUsageGateway.deleteQuota).toHaveBeenCalledWith(
        '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        'e49c4e06-a95f-481d-a456-9dd066591067',
      ),
    );
  });

  it('renders authoritative today reset timing and source freshness', async () => {
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse({
        availability: 'resetSoon',
        quotas: [
          quotaResponse({
            remainingPercent: 30,
            resetTiming: 'today',
            status: 'resetSoon',
            trackingSource: 'pasted',
            usageUpdatedAt: '2026-08-08T00:00:00Z',
          }),
        ],
      }),
    ]);
    renderWithProviders(<AgentUsagePage />);

    expect(await screen.findByText(/Resets today at/)).toBeVisible();
    expect(screen.getByText(/Source: Pasted message/)).toBeVisible();
    expect(screen.getByText(/30% remaining/)).toBeVisible();
  });
});

function accountResponse(extra: Record<string, unknown> = {}) {
  return {
    availability: 'exhausted' as const,
    createdAt: '2026-08-08T00:00:00Z',
    customPlatform: null,
    defaultTimezone: 'Asia/Manila',
    id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    identifier: 'paul+codex@example.com',
    nextResetAt: '2026-08-14T07:00:00Z',
    platform: 'codex' as const,
    quotas: [quotaResponse()],
    signInMethod: 'google' as const,
    trackingMode: 'manual' as const,
    updatedAt: '2026-08-08T00:00:00Z',
    ...extra,
  };
}

function quotaResponse(extra: Record<string, unknown> = {}) {
  return {
    accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    createdAt: '2026-08-08T00:00:00Z',
    id: 'e49c4e06-a95f-481d-a456-9dd066591067',
    label: 'Weekly',
    remainingPercent: 0,
    reminders: {
      oneDayBefore: true,
      resetDay: true,
      resetReached: true,
    },
    resetAt: '2026-08-14T07:00:00Z',
    resetReachedAt: null,
    resetTiming: 'future' as const,
    status: 'exhausted' as const,
    timezone: 'Asia/Manila',
    trackingSource: 'manual' as const,
    updatedAt: '2026-08-08T00:00:00Z',
    usageIsStale: false,
    usageUpdatedAt: '2026-08-08T00:00:00Z',
    ...extra,
  };
}
