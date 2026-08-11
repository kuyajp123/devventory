import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { ValidationIssueFilters } from '../models/validation';
import { ValidationIssueFiltersPanel } from './ValidationIssueFilters';

const defaultFilters: ValidationIssueFilters = {
  descending: true,
  page: 1,
  pageSize: 25,
  sort: 'updated_at',
  status: 'open',
};

const production = {
  createdAt: '2026-08-11T00:00:00.000Z',
  description: null,
  id: '9cdbf276-41b2-4289-b330-d8d46b31ae30',
  name: 'Production',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-11T00:00:00.000Z',
};

describe('ValidationIssueFiltersPanel', () => {
  it('shows search while advanced filters are collapsed by default', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ValidationIssueFiltersPanel
        environments={[production]}
        onApply={vi.fn()}
        onReset={vi.fn()}
        values={defaultFilters}
      />,
    );

    expect(
      screen.getByRole('searchbox', { name: 'Search issues' }),
    ).toBeVisible();
    const toggle = screen.getByRole('button', {
      name: 'Toggle advanced issue filters',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Severity')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Severity')).toBeVisible();
    expect(screen.getByText('Environment')).toBeVisible();
  });

  it('submits search while the advanced filters remain collapsed', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    renderWithProviders(
      <ValidationIssueFiltersPanel
        environments={[production]}
        onApply={onApply}
        onReset={vi.fn()}
        values={defaultFilters}
      />,
    );

    await user.type(
      screen.getByRole('searchbox', { name: 'Search issues' }),
      'VERCEL{Enter}',
    );

    expect(onApply).toHaveBeenCalledWith({
      ...defaultFilters,
      page: 1,
      search: 'VERCEL',
    });
  });
});
