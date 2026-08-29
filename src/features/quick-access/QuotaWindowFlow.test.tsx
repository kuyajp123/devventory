import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaWindowFlow } from './QuotaWindowFlow';

const { agentUsageGateway } = vi.hoisted(() => ({
  agentUsageGateway: {
    listAccounts: vi.fn(),
    saveQuota: vi.fn(),
  },
}));

vi.mock('./services/quick-access.gateway', () => ({
  openAgentUsageFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/agent-usage/services/agent-usage.gateway', () => ({
  agentUsageGateway,
}));

vi.mock('@/shared/infrastructure/tauri/invoke-client', () => ({
  invokeCommand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => vi.fn()),
}));

describe('QuotaWindowFlow', () => {
  const antigravityAccountId = 'acc-antigravity-1';
  const claudeAccountId = 'acc-claude-1';
  const customAccountId = 'acc-custom-1';

  const mockQuota1 = {
    id: 'quota-1',
    accountId: antigravityAccountId,
    label: 'Weekly',
    remainingPercent: 35,
    resetAt: '2026-08-20T09:00:00Z',
    resetReachedAt: null,
    resetTiming: 'future' as const,
    status: 'available' as const,
    timezone: 'America/Los_Angeles',
    trackingSource: 'manual' as const,
    reminders: {
      beforeResetHours: 24,
      resetDay: true,
      resetReached: true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    usageIsStale: false,
    usageUpdatedAt: null,
  };

  const mockAccounts = [
    {
      id: antigravityAccountId,
      platform: 'antigravity' as const,
      identifier: 'paul@gmail.com',
      defaultTimezone: 'America/Los_Angeles',
      availability: 'available' as const,
      quotas: [mockQuota1],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      signInMethod: 'google' as const,
      trackingMode: 'manual' as const,
      customPlatform: null,
      nextResetAt: null,
    },
    {
      id: claudeAccountId,
      platform: 'claude_code' as const,
      identifier: 'work@company.com',
      defaultTimezone: 'America/New_York',
      availability: 'available' as const,
      quotas: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      signInMethod: 'google' as const,
      trackingMode: 'manual' as const,
      customPlatform: null,
      nextResetAt: null,
    },
    {
      id: customAccountId,
      platform: 'custom' as const,
      identifier: 'other@example.com',
      defaultTimezone: 'UTC',
      availability: 'available' as const,
      quotas: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      signInMethod: 'email' as const,
      trackingMode: 'manual' as const,
      customPlatform: 'My Custom Platform',
      nextResetAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    agentUsageGateway.listAccounts.mockResolvedValue(mockAccounts);
    agentUsageGateway.saveQuota.mockResolvedValue(mockQuota1);
  });

  it('shows empty state when no Agent Usage accounts exist', async () => {
    agentUsageGateway.listAccounts.mockResolvedValue([]);
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    expect(
      await screen.findByText('No Agent Usage accounts yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Agent Usage' }),
    ).toBeInTheDocument();
  });

  it('filters identifier options by selected platform', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Open platform dropdown
    const platformTrigger = await screen.findByRole('button', {
      name: 'Platform',
    });
    await user.click(platformTrigger);

    // Select Antigravity
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    // Open identifier dropdown
    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);

    // Should only show Antigravity accounts
    expect(
      screen.getByRole('button', { name: 'paul@gmail.com' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'work@company.com' }),
    ).not.toBeInTheDocument();
  });

  it('allows selecting and re-confirming the same platform/account without breaking state', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Select Antigravity
    const platformTrigger = await screen.findByRole('button', {
      name: 'Platform',
    });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    // Select account
    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    // Re-click Antigravity (already selected)
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    // Account selection should remain
    expect(identifierTrigger).toHaveTextContent('paul@gmail.com');
  });

  it('saves quota in New mode with default reset time when Set reset time is not clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Select platform and account
    const platformTrigger = await screen.findByRole('button', {
      name: 'Platform',
    });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    // Enter label
    const labelInput = screen.getByLabelText('Quota label');
    await user.type(labelInput, 'Weekly');

    // Enter remaining
    const remainingInput = screen.getByLabelText('Remaining percentage');
    await user.type(remainingInput, '35');

    // Click Add quota
    const addBtn = screen.getByRole('button', { name: /Add quota/i });
    await user.click(addBtn);

    expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: antigravityAccountId,
        label: 'Weekly',
        remainingPercent: 35,
        trackingSource: 'manual',
        reminders: expect.objectContaining({
          resetReached: true,
        }),
      }),
    );
  });

  it('switches between New quota and Edit quota modes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    const newTab = await screen.findByRole('button', { name: '+ New quota' });
    const editTab = screen.getByRole('button', { name: 'Edit quota' });

    await user.click(editTab);
    expect(agentUsageGateway.listAccounts).toHaveBeenCalledTimes(2);

    await user.click(newTab);
    expect(
      screen.getByRole('button', { name: '+ New quota' }),
    ).toBeInTheDocument();
  });

  it('shows empty quota state in Edit mode when account has no quotas', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    // Select Claude Code platform (which has quotas: [])
    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Claude Code' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'work@company.com' }));

    expect(
      screen.getByText('No quota windows for this account.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Create a quota window first.'),
    ).toBeInTheDocument();

    const newBtns = screen.getAllByRole('button', { name: '+ New quota' });
    await user.click(newBtns[newBtns.length - 1]);

    // Should switch back to New mode
    expect(
      screen.getByRole('button', { name: /Add quota/i }),
    ).toBeInTheDocument();
  });

  it('prefills form and preserves resetAt when editing an existing quota without touching reset time', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    // Select Antigravity and account
    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    // Select Quota Window
    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Form fields should be prefilled
    expect(screen.getByLabelText('Quota label')).toHaveValue('Weekly');
    expect(screen.getByLabelText('Remaining percentage')).toHaveValue(35);
    expect(
      screen.getByRole('checkbox', { name: /When reset time is reached/ }),
    ).toBeChecked();
    expect(screen.getByText('RESET TIME')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change reset time' }),
    ).toBeInTheDocument();

    // Edit remaining percentage
    const remainingInput = screen.getByLabelText('Remaining percentage');
    await user.clear(remainingInput);
    await user.type(remainingInput, '20');

    // Click Save changes
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    await user.click(saveBtn);

    expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith({
      id: 'quota-1',
      accountId: antigravityAccountId,
      label: 'Weekly',
      remainingPercent: 20,
      resetAt: '2026-08-20T09:00:00Z', // EXACT UNCHANGED resetAt!
      timezone: 'America/Los_Angeles',
      trackingSource: 'manual',
      reminders: {
        beforeResetHours: 24, // Preserved!
        resetDay: true, // Preserved!
        resetReached: true,
      },
    });
  });

  it('preserves hidden reminder fields when updating reminder checkbox in Edit mode', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode and select quota
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Uncheck reset reached reminder
    const checkbox = screen.getByRole('checkbox', {
      name: /When reset time is reached/,
    });
    await user.click(checkbox);

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    await user.click(saveBtn);

    expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith({
      id: 'quota-1',
      accountId: antigravityAccountId,
      label: 'Weekly',
      remainingPercent: 35,
      resetAt: '2026-08-20T09:00:00Z',
      timezone: 'America/Los_Angeles',
      trackingSource: 'manual',
      reminders: {
        beforeResetHours: 24, // Preserved!
        resetDay: true, // Preserved!
        resetReached: false, // Updated!
      },
    });
  });

  it('updates resetAt when Change reset time -> Exact date & time is edited', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode and select quota
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Click Change reset time
    const changeResetBtn = screen.getByRole('button', {
      name: 'Change reset time',
    });
    await user.click(changeResetBtn);

    // Enter new date and time
    const dateInput = screen.getByLabelText('Reset date');
    await user.clear(dateInput);
    await user.type(dateInput, '2028-08-25');

    const timeInput = screen.getByLabelText('Reset time');
    await user.clear(timeInput);
    await user.type(timeInput, '10:00');

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    await user.click(saveBtn);

    expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'quota-1',
        resetAt: expect.stringMatching(/^2028-08-25/),
      }),
    );
  });

  it('restores original resetAt when Cancel reset change is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode and select quota
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Open reset editor
    const changeResetBtn = screen.getByRole('button', {
      name: 'Change reset time',
    });
    await user.click(changeResetBtn);

    // Modify date text
    const dateInput = screen.getByLabelText('Reset date');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-12-31');

    // Click Cancel reset change
    const cancelBtn = screen.getByRole('button', {
      name: 'Cancel reset change',
    });
    await user.click(cancelBtn);

    // Reset summary should be restored and editor collapsed
    expect(screen.queryByLabelText('Reset date')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change reset time' }),
    ).toBeInTheDocument();

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    await user.click(saveBtn);

    expect(agentUsageGateway.saveQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'quota-1',
        resetAt: '2026-08-20T09:00:00Z', // Unchanged!
      }),
    );
  });

  it('shows success state after editing quota and supports Edit another', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode and select quota
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Click Save changes
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    await user.click(saveBtn);

    expect(await screen.findByText('Quota window updated')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();

    // Click Edit another
    const editAnotherBtn = screen.getByRole('button', { name: 'Edit another' });
    await user.click(editAnotherBtn);

    // Account selection should be preserved, quota selector cleared
    expect(screen.getByRole('button', { name: 'Platform' })).toHaveTextContent(
      'Antigravity',
    );
    expect(
      screen.getByRole('button', { name: 'Identifier' }),
    ).toHaveTextContent('paul@gmail.com');
    expect(
      screen.getByRole('button', { name: 'Quota Window' }),
    ).toHaveTextContent('Select quota window...');
  });

  it('computes remaining days, hours, minutes from existing quota resetAt in Reset in tab when editing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Switch to Edit mode and select quota
    const editTab = await screen.findByRole('button', { name: 'Edit quota' });
    await user.click(editTab);

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    const quotaTrigger = screen.getByRole('button', { name: 'Quota Window' });
    await user.click(quotaTrigger);
    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    // Click Change reset time
    await user.click(screen.getByRole('button', { name: 'Change reset time' }));

    // Switch to "Reset in" tab
    await user.click(screen.getByRole('button', { name: 'Reset in' }));

    // Input fields should contain computed duration
    const daysInput = screen.getByLabelText('Days');
    const hoursInput = screen.getByLabelText('Hours');
    const minutesInput = screen.getByLabelText('Minutes');

    expect(
      Number((daysInput as HTMLInputElement).value),
    ).toBeGreaterThanOrEqual(0);
    expect(
      Number((hoursInput as HTMLInputElement).value),
    ).toBeGreaterThanOrEqual(0);
    expect(
      Number((minutesInput as HTMLInputElement).value),
    ).toBeGreaterThanOrEqual(0);
  });

  it('synchronizes values between Exact date & time and Reset in tabs', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    // Select account
    const platformTrigger = await screen.findByRole('button', {
      name: 'Platform',
    });
    await user.click(platformTrigger);
    await user.click(screen.getByRole('button', { name: 'Antigravity' }));

    const identifierTrigger = screen.getByRole('button', {
      name: 'Identifier',
    });
    await user.click(identifierTrigger);
    await user.click(screen.getByRole('button', { name: 'paul@gmail.com' }));

    // Set reset time
    await user.click(screen.getByRole('button', { name: 'Set reset time' }));

    // Switch to "Reset in" tab and enter 2 days, 5 hours, 30 minutes
    await user.click(screen.getByRole('button', { name: 'Reset in' }));

    const daysInput = screen.getByLabelText('Days');
    await user.clear(daysInput);
    await user.type(daysInput, '2');

    const hoursInput = screen.getByLabelText('Hours');
    await user.clear(hoursInput);
    await user.type(hoursInput, '5');

    const minutesInput = screen.getByLabelText('Minutes');
    await user.clear(minutesInput);
    await user.type(minutesInput, '30');

    // Switch back to "Exact date & time" tab
    await user.click(screen.getByRole('button', { name: 'Exact date & time' }));

    const dateInput = screen.getByLabelText('Reset date') as HTMLInputElement;
    const timeInput = screen.getByLabelText('Reset time') as HTMLInputElement;

    expect(dateInput.value).not.toBe('');
    expect(timeInput.value).not.toBe('');
  });

  it('calls onClose when Done or Back button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<QuotaWindowFlow onClose={onClose} />);

    const backBtn = await screen.findByRole('button', {
      name: 'Back to Quick Actions',
    });
    await user.click(backBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
