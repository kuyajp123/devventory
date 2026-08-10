import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEARCH_REQUEST } from '../models/search';
import { SearchFilters } from './SearchFilters';

const sampleEnvironment = {
  createdAt: '2026-08-09T00:00:00.000Z',
  description: null,
  id: '9cdbf276-41b2-4289-b330-d8d46b31ae30',
  name: 'Production',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-09T00:00:00.000Z',
};

const sampleProject = {
  createdAt: '2026-08-01T00:00:00.000Z',
  description: null,
  exclusions: [],
  id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  initialScan: {
    completed: true,
    directoriesVisited: 1,
    durationMs: 1,
    entriesExcluded: 0,
    entriesUnreadable: 0,
    filesDiscovered: 1,
  },
  name: 'Devventory',
  projectType: 'desktop' as const,
  rootPath: 'C:\\workspace\\devventory',
  updatedAt: '2026-08-01T00:00:00.000Z',
  watchedLocations: ['.'],
};

describe('SearchFilters', () => {
  it('is collapsed initially and shows filter fields upon expanding', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SearchFilters
        environments={[sampleEnvironment]}
        onApply={vi.fn()}
        onProjectScopeChange={vi.fn()}
        onQueryChange={vi.fn()}
        projects={[sampleProject]}
        request={DEFAULT_SEARCH_REQUEST}
      />,
    );

    const toggleBtn = screen.getByRole('button', {
      name: 'Toggle advanced filters',
    });
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Project scope')).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Project scope')).toBeInTheDocument();
    expect(screen.getByText('Modified date range')).toBeInTheDocument();
  });

  it('displays active filter count when filters are configured and preserves values when collapsing', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithProviders(
      <SearchFilters
        environments={[sampleEnvironment]}
        onApply={onApply}
        onProjectScopeChange={vi.fn()}
        onQueryChange={vi.fn()}
        projects={[sampleProject]}
        request={DEFAULT_SEARCH_REQUEST}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Toggle advanced filters' }),
    );
    await selectOption(user, 'Project scope', 'Devventory');
    await selectOption(user, 'Environment', 'Production');

    expect(screen.getByText('Filters • 2')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Toggle advanced filters' }),
    );
    expect(screen.getByText('Filters • 2')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search metadata'), 'logo');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        environmentIds: ['9cdbf276-41b2-4289-b330-d8d46b31ae30'],
        projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        query: 'logo',
      }),
      true,
    );
  });

  it('resets all filter fields when Reset is clicked inside expanded panel', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const fromMs = new Date('2026-08-01T00:00:00.000Z').getTime();
    const toMs = new Date('2026-08-10T23:59:59.999Z').getTime();

    renderWithProviders(
      <SearchFilters
        environments={[sampleEnvironment]}
        onApply={onApply}
        onProjectScopeChange={vi.fn()}
        onQueryChange={vi.fn()}
        projects={[sampleProject]}
        request={{
          ...DEFAULT_SEARCH_REQUEST,
          modifiedFromMs: fromMs,
          modifiedToMs: toMs,
        }}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Toggle advanced filters' }),
    );
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modifiedFromMs: null,
        modifiedToMs: null,
      }),
      false,
    );
  });
});

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole('button', { name: new RegExp(label) }));
  await user.click(screen.getByRole('option', { name: option }));
}
