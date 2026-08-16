import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type {
  ValidationIssue,
  ValidationIssueFilters,
} from '../models/validation';
import { ValidationIssueTable } from './ValidationIssueTable';

const defaultFilters: ValidationIssueFilters = {
  descending: true,
  page: 1,
  pageSize: 25,
  sort: 'updated_at',
  status: 'open',
};

const sampleIssue: ValidationIssue = {
  environmentId: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  environmentName: 'Production',
  firstSeenAt: '2026-08-08T00:00:00.000Z',
  id: '4ce13759-a72a-4595-8133-2d7100f42f01',
  issueType: 'required_missing',
  keyName: 'DATABASE_URL',
  lastSeenAt: '2026-08-08T00:00:00.000Z',
  lineNumber: null,
  message: 'Required key is missing.',
  observedName: null,
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  resolvedAt: null,
  ruleId: '6ce45b9b-83fe-48f1-a744-17739bfbd7fd',
  severity: 'error',
  sourcePath: null,
  status: 'open',
  updatedAt: '2026-08-08T00:00:00.000Z',
};

describe('ValidationIssueTable', () => {
  it('renders issues list and calls onNavigateToCell when View button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToCell = vi.fn();
    const onStatusChange = vi.fn();

    renderWithProviders(
      <ValidationIssueTable
        filters={defaultFilters}
        isLoading={false}
        isUpdating={false}
        issues={[sampleIssue]}
        onFilterChange={vi.fn()}
        onNavigateToCell={onNavigateToCell}
        onStatusChange={onStatusChange}
        totalItems={1}
        totalPages={1}
      />,
    );

    expect(screen.getByText('DATABASE_URL')).toBeVisible();
    expect(screen.getByText('Production')).toBeVisible();

    const viewButton = screen.getByRole('button', {
      name: 'Highlight DATABASE_URL in environment matrix',
    });
    expect(viewButton).toBeVisible();
    await user.click(viewButton);
    expect(onNavigateToCell).toHaveBeenCalledWith(sampleIssue);
  });

  it('calls onStatusChange when Ignore button is clicked', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    renderWithProviders(
      <ValidationIssueTable
        filters={defaultFilters}
        isLoading={false}
        isUpdating={false}
        issues={[sampleIssue]}
        onFilterChange={vi.fn()}
        onStatusChange={onStatusChange}
        totalItems={1}
        totalPages={1}
      />,
    );

    const ignoreButton = screen.getByRole('button', {
      name: 'Ignore DATABASE_URL issue',
    });
    expect(ignoreButton).toBeVisible();
    await user.click(ignoreButton);
    expect(onStatusChange).toHaveBeenCalledWith(sampleIssue);
  });

  it('disables navigate button when issue has no environmentId', () => {
    const projectLevelIssue: ValidationIssue = {
      ...sampleIssue,
      environmentId: null,
      environmentName: null,
    };

    renderWithProviders(
      <ValidationIssueTable
        filters={defaultFilters}
        isLoading={false}
        isUpdating={false}
        issues={[projectLevelIssue]}
        onFilterChange={vi.fn()}
        onNavigateToCell={vi.fn()}
        onStatusChange={vi.fn()}
        totalItems={1}
        totalPages={1}
      />,
    );

    const viewButton = screen.getByRole('button', {
      name: 'Highlight DATABASE_URL in environment matrix',
    });
    expect(viewButton).toBeDisabled();
  });
});
