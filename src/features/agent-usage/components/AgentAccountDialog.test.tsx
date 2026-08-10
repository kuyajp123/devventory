import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentAccount } from '../models/agent-usage';
import { AgentAccountDialog } from './AgentAccountDialog';

const sampleAccount: AgentAccount = {
  availability: 'available',
  createdAt: '2026-08-08T00:00:00Z',
  customPlatform: null,
  defaultTimezone: 'Asia/Manila',
  id: 'acc-1',
  identifier: 'johnpaulnaag10@gmail.com',
  nextResetAt: '2026-08-16T11:53:00Z',
  platform: 'antigravity',
  quotas: [],
  signInMethod: 'google',
  trackingMode: 'manual',
  updatedAt: '2026-08-08T00:00:00Z',
};

describe('AgentAccountDialog', () => {
  it('pre-fills full account identifier field when editing an existing account', () => {
    renderWithProviders(
      <AgentAccountDialog
        account={sampleAccount}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Edit coding-agent account')).toBeInTheDocument();
    const identifierInput = screen.getByLabelText('Full account identifier');
    expect(identifierInput).toHaveValue('johnpaulnaag10@gmail.com');
  });

  it('renders an empty identifier field when adding a new account', () => {
    renderWithProviders(
      <AgentAccountDialog
        account={null}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('Add coding-agent account')).toBeInTheDocument();
    const identifierInput = screen.getByLabelText('Full account identifier');
    expect(identifierInput).toHaveValue('');
  });
});
