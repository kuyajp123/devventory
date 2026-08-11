import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Environment } from '@/features/environment-tracker';
import type { ValidationRule } from '../models/validation';
import { ValidationRulePanel } from './ValidationRulePanel';

const environment: Environment = {
  createdAt: '2026-08-08T00:00:00.000Z',
  description: null,
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Development',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-08T00:00:00.000Z',
};

function makeRule(keyName: string, id: string): ValidationRule {
  return {
    createdAt: '2026-08-08T00:00:00.000Z',
    description: null,
    enabled: true,
    environmentIds: [environment.id],
    id,
    keyName,
    projectId: environment.projectId,
    ruleType: 'required',
    severity: 'error',
    sortOrder: 0,
    updatedAt: '2026-08-08T00:00:00.000Z',
  };
}

describe('ValidationRulePanel search', () => {
  const rules = [
    makeRule('DATABASE_URL', 'rule-1'),
    makeRule('SUPABASE_DB_URL', 'rule-2'),
    makeRule('SERVICE-ACCOUNT.json', 'rule-3'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows all rules when search is empty', () => {
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('SUPABASE_DB_URL')).toBeInTheDocument();
    expect(screen.getByText('SERVICE-ACCOUNT.json')).toBeInTheDocument();
  });

  it('filters rules by key name (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'supabase');

    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument();
    expect(screen.getByText('SUPABASE_DB_URL')).toBeInTheDocument();
    expect(screen.queryByText('SERVICE-ACCOUNT.json')).not.toBeInTheDocument();
  });

  it('matches custom filename-like keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'service-account');

    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument();
    expect(screen.queryByText('SUPABASE_DB_URL')).not.toBeInTheDocument();
    expect(screen.getByText('SERVICE-ACCOUNT.json')).toBeInTheDocument();
  });

  it('shows no-match state when search has no results', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'firebase');

    expect(screen.getByText(/No validation rules match/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Clear search/ }).length,
    ).toBeGreaterThan(0);
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'supabase');
    expect(screen.getByText('SUPABASE_DB_URL')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(searchInput).toHaveValue('');
    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('SERVICE-ACCOUNT.json')).toBeInTheDocument();
  });

  it('disables reordering while search is active', async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={onReorder}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'db');

    const moveUpButtons = screen.getAllByRole('button', { name: /Move .+ up/ });
    moveUpButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('shows result count when search is active', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ValidationRulePanel
        environments={[environment]}
        isLoading={false}
        isReordering={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onReorder={vi.fn()}
        onToggle={vi.fn()}
        rules={rules}
      />,
    );

    const searchInput = screen.getByLabelText('Search validation rules');
    await user.type(searchInput, 'url');

    expect(await screen.findByText('2 of 3 rules')).toBeInTheDocument();
  });
});
