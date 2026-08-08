import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_SEARCH_REQUEST } from '../models/search';
import { SearchFilters } from './SearchFilters';

describe('SearchFilters', () => {
  it('composes project, file, origin, tag, extension, and environment filters', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithProviders(
      <SearchFilters
        environments={[
          {
            createdAt: '2026-08-09T00:00:00.000Z',
            description: null,
            id: '9cdbf276-41b2-4289-b330-d8d46b31ae30',
            name: 'Production',
            projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
            sortOrder: 0,
            updatedAt: '2026-08-09T00:00:00.000Z',
          },
        ]}
        onApply={onApply}
        onQueryChange={vi.fn()}
        onProjectScopeChange={vi.fn()}
        projects={[
          {
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
            projectType: 'desktop',
            rootPath: 'C:\\workspace\\devventory',
            updatedAt: '2026-08-01T00:00:00.000Z',
            watchedLocations: ['.'],
          },
        ]}
        request={DEFAULT_SEARCH_REQUEST}
      />,
    );

    await user.type(screen.getByLabelText('Search metadata'), 'logo');
    await selectOption(user, 'Project scope', 'Devventory');
    await selectOption(user, 'Environment', 'Production');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        environmentIds: ['9cdbf276-41b2-4289-b330-d8d46b31ae30'],
        page: 1,
        projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        query: 'logo',
      }),
      true,
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
