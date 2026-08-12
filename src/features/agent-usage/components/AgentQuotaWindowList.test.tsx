import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentAccount, AgentQuota } from '../models/agent-usage';
import { AgentQuotaWindowList } from './AgentQuotaWindowList';

function createQuota(
  id: string,
  label: string,
  remainingPercent: number | null,
  status: AgentQuota['status'] = 'available',
): AgentQuota {
  return {
    accountId: 'acc-1',
    createdAt: '2026-08-08T00:00:00Z',
    id,
    label,
    remainingPercent,
    reminders: { beforeResetHours: 24, resetDay: true, resetReached: true },
    resetAt: '2026-08-16T11:53:00Z',
    resetReachedAt: null,
    resetTiming: 'future',
    status,
    timezone: 'Asia/Manila',
    trackingSource: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
    usageIsStale: false,
    usageUpdatedAt: '2026-08-08T00:00:00Z',
  };
}

function createAccount(quotas: AgentQuota[]): AgentAccount {
  return {
    availability: 'available',
    createdAt: '2026-08-08T00:00:00Z',
    customPlatform: null,
    defaultTimezone: 'Asia/Manila',
    id: 'acc-1',
    identifier: 'paul@gmail.com',
    nextResetAt: '2026-08-16T11:53:00Z',
    platform: 'antigravity',
    quotas,
    signInMethod: 'google',
    trackingMode: 'manual',
    updatedAt: '2026-08-08T00:00:00Z',
  };
}

describe('AgentQuotaWindowList', () => {
  it('renders multiple simultaneous progress bars with independent, correct theme fill classes', () => {
    const account = createAccount([
      createQuota('q-90', 'Gemini Models - Five Hour Limit', 90, 'resetSoon'),
      createQuota('q-15', 'gemini models - weekly', 15, 'limited'),
      createQuota('q-25', 'gemini models - daily', 25, 'limited'),
    ]);

    const { container } = renderWithProviders(
      <AgentQuotaWindowList
        account={account}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const fills = container.querySelectorAll('[data-slot="progress-bar-fill"]');
    expect(fills).toHaveLength(3);

    // Quota 90% -> bg-success
    expect(fills[0]).toHaveClass('bg-success');
    expect(fills[0]).not.toHaveClass('bg-danger');

    // Quota 15% -> bg-danger
    expect(fills[1]).toHaveClass('bg-danger');
    expect(fills[1]).not.toHaveClass('bg-success');

    // Quota 25% -> bg-warning
    expect(fills[2]).toHaveClass('bg-warning');
  });

  it('maintains deterministic progress colors after unmounting and remounting', () => {
    const account = createAccount([
      createQuota('q-90', 'Gemini Models - Five Hour Limit', 90),
      createQuota('q-15', 'gemini models - weekly', 15),
    ]);

    // Initial mount
    const { container: c1, unmount } = renderWithProviders(
      <AgentQuotaWindowList
        account={account}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const fills1 = c1.querySelectorAll('[data-slot="progress-bar-fill"]');
    expect(fills1[0]).toHaveClass('bg-success');
    expect(fills1[1]).toHaveClass('bg-danger');

    // Collapse / Unmount
    unmount();

    // Re-mount
    const { container: c2 } = renderWithProviders(
      <AgentQuotaWindowList
        account={account}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const fills2 = c2.querySelectorAll('[data-slot="progress-bar-fill"]');
    expect(fills2[0]).toHaveClass('bg-success');
    expect(fills2[1]).toHaveClass('bg-danger');
  });

  it('renders fill colors attached to corresponding quota regardless of render order', () => {
    // Order [15%, 90%]
    const account15First = createAccount([
      createQuota('q-15', 'gemini models - weekly', 15),
      createQuota('q-90', 'Gemini Models - Five Hour Limit', 90),
    ]);

    const { container } = renderWithProviders(
      <AgentQuotaWindowList
        account={account15First}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const fills = container.querySelectorAll('[data-slot="progress-bar-fill"]');
    expect(fills[0]).toHaveClass('bg-danger');
    expect(fills[1]).toHaveClass('bg-success');
  });

  it('decouples remaining percentage fill color from badge availability status', () => {
    // 90% remaining with badge RESET SOON -> progress fill is still bg-success
    // 15% remaining with badge LIMITED -> progress fill is still bg-danger
    const account = createAccount([
      createQuota('q-90', 'High Percentage Reset Soon', 90, 'resetSoon'),
      createQuota('q-15', 'Low Percentage Limited', 15, 'limited'),
    ]);

    const { container } = renderWithProviders(
      <AgentQuotaWindowList
        account={account}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText('Reset soon')).toBeInTheDocument();
    expect(screen.getByText('Limited')).toBeInTheDocument();

    const fills = container.querySelectorAll('[data-slot="progress-bar-fill"]');
    expect(fills[0]).toHaveClass('bg-success');
    expect(fills[1]).toHaveClass('bg-danger');
  });
});
