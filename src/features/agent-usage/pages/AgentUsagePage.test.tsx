import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { renderWithProviders } from '@/test/render';
import { agentUsageGateway } from '../services/agent-usage.gateway';
import { navigationIntentStore } from '../services/navigation-intent.store';
import { AgentUsagePage } from './AgentUsagePage';

function renderAgentUsagePage() {
  return renderWithProviders(
    <MemoryRouter>
      <AgentUsagePage />
    </MemoryRouter>,
  );
}

vi.mock('../services/agent-usage.gateway', () => ({
  agentUsageGateway: {
    deleteAccount: vi.fn(),
    deleteQuota: vi.fn(),
    listAccounts: vi.fn(),
    saveAccount: vi.fn(),
    saveQuota: vi.fn(),
    takeDueReminders: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => vi.fn()),
}));

describe('AgentUsagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse(),
    ]);
    vi.mocked(agentUsageGateway.saveQuota).mockResolvedValue(quotaResponse());
    vi.mocked(agentUsageGateway.deleteAccount).mockResolvedValue(undefined);
    vi.mocked(agentUsageGateway.deleteQuota).mockResolvedValue(undefined);
    navigationIntentStore.clear();
  });

  it('preserves a targeted reminder intent until account data is ready', async () => {
    let resolveAccounts:
      ((accounts: ReturnType<typeof accountResponse>[]) => void) | undefined;
    vi.mocked(agentUsageGateway.listAccounts).mockReturnValue(
      new Promise((resolve) => {
        resolveAccounts = resolve;
      }),
    );
    navigationIntentStore.setIntent({
      accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      quotaWindowId: 'e49c4e06-a95f-481d-a456-9dd066591067',
      type: 'individual',
    });

    renderAgentUsagePage();
    await waitFor(() =>
      expect(agentUsageGateway.listAccounts).toHaveBeenCalled(),
    );
    expect(navigationIntentStore.peekIntent()).not.toBeNull();

    resolveAccounts?.([accountResponse()]);

    await screen.findByText('paul+codex@example.com');
    await waitFor(() => expect(navigationIntentStore.peekIntent()).toBeNull());
  });

  it('renders the full account identifier and availability without project context', async () => {
    renderAgentUsagePage();

    expect(
      await screen.findByRole('heading', { name: 'Agent Usage' }),
    ).toBeVisible();
    expect(await screen.findByText('paul+codex@example.com')).toBeVisible();
    expect(screen.getAllByText('Exhausted').length).toBeGreaterThan(0);
  });

  it('groups accounts by platform and gives every availability a stable semantic treatment', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse({
        availability: 'available',
        id: '04675d66-b8a5-45f3-b281-62524aa70001',
        identifier: 'available@example.com',
        quotas: [
          quotaResponse({
            accountId: '04675d66-b8a5-45f3-b281-62524aa70001',
            id: '84675d66-b8a5-45f3-b281-62524aa70001',
            remainingPercent: 75,
            status: 'available',
          }),
        ],
      }),
      accountResponse({
        availability: 'limited',
        id: '04675d66-b8a5-45f3-b281-62524aa70002',
        identifier: 'limited@example.com',
        quotas: [
          quotaResponse({
            accountId: '04675d66-b8a5-45f3-b281-62524aa70002',
            id: '84675d66-b8a5-45f3-b281-62524aa70002',
            remainingPercent: 8,
            status: 'limited',
          }),
        ],
      }),
      accountResponse({
        id: '04675d66-b8a5-45f3-b281-62524aa70003',
        identifier: 'exhausted@example.com',
        quotas: [
          quotaResponse({
            accountId: '04675d66-b8a5-45f3-b281-62524aa70003',
            id: '84675d66-b8a5-45f3-b281-62524aa70003',
          }),
        ],
      }),
      accountResponse({
        availability: 'unknown',
        id: '04675d66-b8a5-45f3-b281-62524aa70004',
        identifier: 'unknown@example.com',
        nextResetAt: null,
        quotas: [],
      }),
    ]);
    renderAgentUsagePage();

    const codexGroup = await screen.findByRole('region', {
      name: 'Codex platform accounts',
    });
    expect(codexGroup).toBeVisible();
    expect(within(codexGroup).getAllByText('Codex')).toHaveLength(1);
    expectStatusColor('Available', 'bg-success/15');
    expectStatusColor('Limited', 'bg-warning/15');
    expectStatusColor('Exhausted', 'bg-danger/15');
    expectStatusColor('Unknown', 'bg-default/40');

    await user.click(
      screen.getByRole('button', {
        name: 'Expand account limited@example.com',
      }),
    );
    const limitedStatus = statusElement('Limited');
    expect(limitedStatus).toHaveClass('bg-warning/15');
    expect(limitedStatus).not.toHaveClass('bg-success/15');
  });

  it('keeps multiple quota windows inside an expandable account row', async () => {
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse({
        quotas: [
          quotaResponse(),
          quotaResponse({
            id: 'e49c4e06-a95f-481d-a456-9dd066591068',
            label: 'Daily',
            remainingPercent: 42,
            status: 'available',
          }),
        ],
      }),
    ]);
    const user = userEvent.setup();
    renderAgentUsagePage();

    const expandAccount = await screen.findByRole('button', {
      name: 'Expand account paul+codex@example.com',
    });
    expect(screen.queryByText('Quota windows')).not.toBeInTheDocument();

    await user.click(expandAccount);

    expect(screen.getByRole('heading', { name: 'Weekly' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Daily' })).toBeVisible();
    expect(expandAccount).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses platform groups without losing their accounts', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await screen.findByText('paul+codex@example.com');
    await user.click(
      screen.getByRole('button', {
        name: 'Collapse Codex platform accounts',
      }),
    );
    expect(
      screen
        .getByText('paul+codex@example.com')
        .closest('[data-slot="disclosure-content"]'),
    ).not.toHaveAttribute('data-expanded', 'true');

    await user.click(
      screen.getByRole('button', {
        name: 'Expand Codex platform accounts',
      }),
    );
    expect(await screen.findByText('paul+codex@example.com')).toBeVisible();
    expect(
      screen
        .getByText('paul+codex@example.com')
        .closest('[data-slot="disclosure-content"]'),
    ).toHaveAttribute('data-expanded', 'true');
  });

  it('retains platform grouping while searching and exposes filtered recovery', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.listAccounts).mockResolvedValue([
      accountResponse(),
      accountResponse({
        availability: 'available',
        id: '04675d66-b8a5-45f3-b281-62524aa70005',
        identifier: 'cursor@example.com',
        platform: 'cursor',
        quotas: [],
      }),
    ]);
    renderAgentUsagePage();

    const search = await screen.findByLabelText('Search account identifier');
    await user.type(search, 'cursor@example.com');
    expect(
      await screen.findByRole('region', { name: 'Cursor platform accounts' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Codex platform accounts' }),
    ).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'missing-account');
    expect(
      await screen.findByText('No accounts match the current filters'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      await screen.findByRole('region', { name: 'Codex platform accounts' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Cursor platform accounts' }),
    ).toBeVisible();
  });

  it('starts account creation with the selected platform group', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await user.click(
      await screen.findByRole('button', { name: 'Add account to Codex' }),
    );

    expect(
      screen.getByRole('button', { name: /Coding-agent platform/ }),
    ).toHaveTextContent('Codex');
  });

  it('adds a manual built-in provider account with its selected sign-in method', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.saveAccount).mockResolvedValue(
      accountResponse({ identifier: 'work@example.com', quotas: [] }),
    );
    renderAgentUsagePage();

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
    renderAgentUsagePage();

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
    renderAgentUsagePage();

    await openAccountAction(user, 'Edit account');
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

    await openAccountAction(user, 'Delete account');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(agentUsageGateway.deleteAccount).toHaveBeenCalledWith(
        '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      ),
    );
  });

  it('saves a quota window with an exact date and time without a preview step', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );

    // The dialog opens with Exact date & time selected by default.
    // The Add quota button is available immediately (no preview/confirm step).
    const saveButton = screen.getByRole('button', { name: 'Add quota' });
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    await waitFor(() =>
      expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
          label: 'Weekly',
          remainingPercent: null,
          timezone: 'Asia/Manila',
          trackingSource: 'manual',
        }),
      ),
    );
    // The computed resetAt is a future UTC ISO string.
    const call = vi.mocked(agentUsageGateway.saveQuota).mock.calls[0][0];
    expect(new Date(call.resetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('shows an inline error and blocks save when relative reset delta is zero', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Reset in' }));
    // Clear all three fields to zero
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Hours'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByLabelText('Minutes'), {
      target: { value: '0' },
    });

    await user.click(screen.getByRole('button', { name: 'Add quota' }));

    expect(
      await screen.findByText('Enter a positive duration (at least 1 minute).'),
    ).toBeVisible();
    expect(agentUsageGateway.saveQuota).not.toHaveBeenCalled();
  });

  it('saves a valid relative reset quota', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Reset in' }));
    await user.clear(screen.getByLabelText('Days'));
    await user.type(screen.getByLabelText('Days'), '7');

    await user.click(screen.getByRole('button', { name: 'Add quota' }));

    await waitFor(() =>
      expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingSource: 'manual',
        }),
      ),
    );
    const call = vi.mocked(agentUsageGateway.saveQuota).mock.calls[0][0];
    // 7 days from now should be in the future
    expect(new Date(call.resetAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('shows duplicate quota-label conflicts on the label field instead of a toast', async () => {
    const user = userEvent.setup();
    vi.mocked(agentUsageGateway.saveQuota).mockRejectedValue(
      new TauriCommandError('save_agent_quota', {
        code: 'AGENT_USAGE_CONFLICT',
        message: 'That quota window label is already used for this account.',
      }),
    );
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );
    // Use the Exact date & time mode (default) – Add quota is available immediately.
    await user.click(screen.getByRole('button', { name: 'Add quota' }));

    const label = screen.getByLabelText('Quota window label');
    const message = 'That quota window label is already used for this account.';
    await waitFor(() => expect(label).toHaveAttribute('aria-invalid', 'true'));
    expect(label).toHaveAccessibleDescription(message);
    expect(screen.getAllByText(message)).toHaveLength(1);

    await user.clear(label);
    await user.type(label, 'Monthly');
    expect(label).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it('Paste message button is not present in the dialog', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Add quota for paul+codex@example.com',
      }),
    );

    expect(
      screen.queryByRole('button', { name: 'Paste message' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Preview reset' }),
    ).not.toBeInTheDocument();
  });

  it('edits and removes quota windows without requiring usage percentage', async () => {
    const user = userEvent.setup();
    renderAgentUsagePage();

    await expandAccount(user);
    await user.click(
      screen.getByRole('button', {
        name: 'Edit Weekly quota for paul+codex@example.com',
      }),
    );
    await user.clear(screen.getByLabelText('Usage remaining (optional %)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
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
    renderAgentUsagePage();

    await expandAccount(userEvent.setup());
    expect(await screen.findByText(/Resets today at/)).toBeVisible();
    expect(screen.getByText(/Source: Pasted message/)).toBeVisible();
    expect(screen.getAllByText(/30% remaining/).length).toBeGreaterThan(0);
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
      beforeResetHours: 24,
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

function expectStatusColor(label: string, colorClass: string) {
  const status = statusElement(label);
  expect(status).toHaveAttribute(
    'data-status',
    label === 'Reset soon' ? 'resetSoon' : label.toLocaleLowerCase(),
  );
  expect(status).toHaveClass(colorClass);
}

function statusElement(label: string) {
  return screen
    .getAllByText(label)
    .map((element) => element.closest('[data-status]'))
    .find(Boolean);
}

async function expandAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: 'Expand account paul+codex@example.com',
    }),
  );
}

async function openAccountAction(
  user: ReturnType<typeof userEvent.setup>,
  action: 'Delete account' | 'Edit account',
) {
  await user.click(
    await screen.findByRole('button', {
      name: 'Open actions for paul+codex@example.com',
    }),
  );
  await user.click(await screen.findByRole('menuitem', { name: action }));
}
