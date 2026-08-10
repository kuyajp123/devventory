import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AgentAccount } from '../models/agent-usage';
import type { AgentPlatformGroup as AgentPlatformGroupModel } from '../models/agent-usage-view';
import { AgentPlatformGroup } from './AgentPlatformGroup';

const sampleAccounts: AgentAccount[] = [
  {
    availability: 'exhausted',
    createdAt: '2026-08-08T00:00:00Z',
    customPlatform: null,
    defaultTimezone: 'Asia/Manila',
    id: 'acc-1',
    identifier: 'johnpaulnaag10@gmail.com',
    nextResetAt: '2026-08-16T11:53:00Z',
    platform: 'antigravity',
    quotas: [
      {
        accountId: 'acc-1',
        createdAt: '2026-08-08T00:00:00Z',
        id: 'q-1',
        label: 'claude and gpt models',
        remainingPercent: 0,
        reminders: { beforeResetHours: 24, resetDay: true, resetReached: true },
        resetAt: '2026-08-16T11:53:00Z',
        resetReachedAt: null,
        resetTiming: 'future',
        status: 'exhausted',
        timezone: 'Asia/Manila',
        trackingSource: 'manual',
        updatedAt: '2026-08-08T00:00:00Z',
        usageIsStale: false,
        usageUpdatedAt: '2026-08-08T00:00:00Z',
      },
      {
        accountId: 'acc-1',
        createdAt: '2026-08-08T00:00:00Z',
        id: 'q-2',
        label: 'gemini models - weekly',
        remainingPercent: 83,
        reminders: { beforeResetHours: 24, resetDay: true, resetReached: true },
        resetAt: '2026-08-16T11:54:00Z',
        resetReachedAt: '2026-08-16T11:54:00Z',
        resetTiming: 'elapsed',
        status: 'available',
        timezone: 'Asia/Manila',
        trackingSource: 'manual',
        updatedAt: '2026-08-08T00:00:00Z',
        usageIsStale: false,
        usageUpdatedAt: '2026-08-08T00:00:00Z',
      },
    ],
    signInMethod: 'google',
    trackingMode: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
  },
  {
    availability: 'exhausted',
    createdAt: '2026-08-08T00:00:00Z',
    customPlatform: null,
    defaultTimezone: 'Asia/Manila',
    id: 'acc-2',
    identifier: 'cecillascarlet123@gmail.com',
    nextResetAt: '2026-08-13T08:55:00Z',
    platform: 'antigravity',
    quotas: [
      {
        accountId: 'acc-2',
        createdAt: '2026-08-08T00:00:00Z',
        id: 'q-3',
        label: 'main model',
        remainingPercent: 0,
        reminders: { beforeResetHours: 24, resetDay: true, resetReached: true },
        resetAt: '2026-08-13T08:55:00Z',
        resetReachedAt: null,
        resetTiming: 'future',
        status: 'exhausted',
        timezone: 'Asia/Manila',
        trackingSource: 'manual',
        updatedAt: '2026-08-08T00:00:00Z',
        usageIsStale: false,
        usageUpdatedAt: '2026-08-08T00:00:00Z',
      },
    ],
    signInMethod: 'google',
    trackingMode: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
  },
];

const sampleGroup: AgentPlatformGroupModel = {
  accounts: sampleAccounts,
  customPlatform: null,
  id: 'antigravity',
  label: 'Antigravity',
  platform: 'antigravity',
};

describe('AgentPlatformGroup', () => {
  it('renders actionable availability summary without N quota windows text', () => {
    renderWithProviders(
      <AgentPlatformGroup
        group={sampleGroup}
        isExpanded
        onAddAccount={vi.fn()}
        onAddQuota={vi.fn()}
        onDeleteAccount={vi.fn()}
        onDeleteQuota={vi.fn()}
        onEditAccount={vi.fn()}
        onEditQuota={vi.fn()}
        onExpandedChange={vi.fn()}
      />,
    );

    expect(screen.getByText('gemini models - weekly')).toBeInTheDocument();
    expect(screen.getByText('83% remaining')).toBeInTheDocument();
    expect(screen.getByText('No available windows')).toBeInTheDocument();
    expect(screen.queryByText(/2 windows/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 window/i)).not.toBeInTheDocument();
  });

  it('collapses expanded accounts when Collapse expanded button is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AgentPlatformGroup
        group={sampleGroup}
        isExpanded
        onAddAccount={vi.fn()}
        onAddQuota={vi.fn()}
        onDeleteAccount={vi.fn()}
        onDeleteQuota={vi.fn()}
        onEditAccount={vi.fn()}
        onEditQuota={vi.fn()}
        onExpandedChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: 'Collapse expanded accounts in Antigravity',
      }),
    ).not.toBeInTheDocument();

    // Expand first account
    await user.click(
      screen.getByRole('button', {
        name: 'Expand account johnpaulnaag10@gmail.com',
      }),
    );
    const collapseBtn = screen.getByRole('button', {
      name: 'Collapse expanded accounts in Antigravity',
    });
    expect(collapseBtn).toBeInTheDocument();
    expect(screen.getByText('Quota windows')).toBeInTheDocument();

    // Click Collapse expanded
    await user.click(collapseBtn);
    expect(
      screen.queryByRole('button', {
        name: 'Collapse expanded accounts in Antigravity',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Quota windows')).not.toBeInTheDocument();
  });
});
