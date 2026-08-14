import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { AgentAccount, AgentQuota } from '../models/agent-usage';
import { AgentQuotaDialog } from './AgentQuotaDialog';

function renderQuotaDialog(ui: React.ReactElement) {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
}

const futureResetAt = new Date(
  Date.now() + 2 * 24 * 60 * 60 * 1000,
).toISOString();

const sampleAccount: AgentAccount = {
  availability: 'available',
  createdAt: '2026-08-08T00:00:00Z',
  customPlatform: null,
  defaultTimezone: 'Asia/Manila',
  id: 'acc-1',
  identifier: 'paul@example.com',
  nextResetAt: futureResetAt,
  platform: 'codex',
  quotas: [],
  signInMethod: 'google',
  trackingMode: 'manual',
  updatedAt: '2026-08-08T00:00:00Z',
};

const existingQuotaCustom6: AgentQuota = {
  accountId: 'acc-1',
  createdAt: '2026-08-08T00:00:00Z',
  id: 'q-1',
  label: 'Weekly',
  remainingPercent: 50,
  reminders: {
    beforeResetHours: 6,
    resetDay: false,
    resetReached: true,
  },
  resetAt: futureResetAt,
  resetReachedAt: null,
  resetTiming: 'future',
  status: 'available',
  timezone: 'Asia/Manila',
  trackingSource: 'manual',
  updatedAt: '2026-08-08T00:00:00Z',
  usageIsStale: false,
  usageUpdatedAt: null,
};

const existingQuotaResetDay: AgentQuota = {
  accountId: 'acc-1',
  createdAt: '2026-08-08T00:00:00Z',
  id: 'q-2',
  label: 'Daily',
  remainingPercent: 80,
  reminders: {
    beforeResetHours: null,
    resetDay: true,
    resetReached: false,
  },
  resetAt: futureResetAt,
  resetReachedAt: null,
  resetTiming: 'future',
  status: 'available',
  timezone: 'Asia/Manila',
  trackingSource: 'manual',
  updatedAt: '2026-08-08T00:00:00Z',
  usageIsStale: false,
  usageUpdatedAt: null,
};

describe('AgentQuotaDialog Reminder Defaults', () => {
  it('defaults new quota to Custom Reminder unchecked, On reset day unchecked, When reset time is reached checked', () => {
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={null}
        saveError={null}
      />,
    );

    const customCheckbox = screen.getByRole('checkbox', {
      name: 'Custom reminder',
    });
    const resetDayCheckbox = screen.getByRole('checkbox', {
      name: 'On reset day',
    });
    const resetReachedCheckbox = screen.getByRole('checkbox', {
      name: 'When reset time is reached',
    });

    expect(customCheckbox).not.toBeChecked();
    expect(resetDayCheckbox).not.toBeChecked();
    expect(resetReachedCheckbox).toBeChecked();
  });

  it('hides Custom Reminder hours input initially on new quota dialog', () => {
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={null}
        saveError={null}
      />,
    );

    expect(screen.queryByText('hours before reset')).not.toBeInTheDocument();
  });

  it('enabling Custom Reminder reveals the hours input with dormant value 24', async () => {
    const user = userEvent.setup();
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={null}
        saveError={null}
      />,
    );

    const customCheckbox = screen.getByRole('checkbox', {
      name: 'Custom reminder',
    });
    await user.click(customCheckbox);

    expect(customCheckbox).toBeChecked();
    expect(screen.getByText('hours before reset')).toBeInTheDocument();
    const hoursInput = screen.getByDisplayValue('24');
    expect(hoursInput).toBeInTheDocument();
  });

  it('submits untouched new quota with beforeResetHours: null, resetDay: false, resetReached: true', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={onSubmit}
        quota={null}
        saveError={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add quota' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        reminders: {
          beforeResetHours: null,
          resetDay: false,
          resetReached: true,
        },
      }),
    );
  });

  it('opens existing quota with beforeResetHours: 6 with Custom Reminder checked and value 6', () => {
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={existingQuotaCustom6}
        saveError={null}
      />,
    );

    const customCheckbox = screen.getByRole('checkbox', {
      name: 'Custom reminder',
    });
    expect(customCheckbox).toBeChecked();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  it('preserves saved reminder preferences when editing existing quota with resetDay enabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={onSubmit}
        quota={existingQuotaResetDay}
        saveError={null}
      />,
    );

    const customCheckbox = screen.getByRole('checkbox', {
      name: 'Custom reminder',
    });
    const resetDayCheckbox = screen.getByRole('checkbox', {
      name: 'On reset day',
    });
    const resetReachedCheckbox = screen.getByRole('checkbox', {
      name: 'When reset time is reached',
    });

    expect(customCheckbox).not.toBeChecked();
    expect(resetDayCheckbox).toBeChecked();
    expect(resetReachedCheckbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        reminders: {
          beforeResetHours: null,
          resetDay: true,
          resetReached: false,
        },
      }),
    );
  });

  it('renders section legend as Reminders and provides Notification settings link', () => {
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={null}
        saveError={null}
      />,
    );

    expect(screen.getByText('Reminders')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notification settings' }),
    ).toBeInTheDocument();
  });

  it('prompts confirmation when clicking Notification settings with unsaved changes', async () => {
    const user = userEvent.setup();
    renderQuotaDialog(
      <AgentQuotaDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSaveErrorClear={vi.fn()}
        onSubmit={vi.fn()}
        quota={null}
        saveError={null}
      />,
    );

    // Make form dirty by changing label
    const labelInput = screen.getByLabelText('Quota window label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Monthly');

    // Click Notification settings link
    await user.click(
      screen.getByRole('button', { name: 'Notification settings' }),
    );

    expect(
      await screen.findByText(
        'You have unsaved quota changes. Leave without saving?',
      ),
    ).toBeInTheDocument();
  });
});
