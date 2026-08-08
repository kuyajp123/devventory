import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_SEARCH_REQUEST } from '../models/search';
import { GlobalSearchPage } from './GlobalSearchPage';

const mocks = vi.hoisted(() => ({
  clearHistory: vi.fn(),
  deleteHistory: vi.fn(),
  recordHistory: vi.fn(),
  searchQuery: vi.fn(),
  searchState: { mode: 'data' as 'data' | 'error' | 'pending' },
  selectProject: vi.fn(),
}));

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProjectId: 'ab89c0c5-7749-41cb-9394-e884454f5077',
    projects: [
      {
        id: 'ab89c0c5-7749-41cb-9394-e884454f5077',
        name: 'Devventory',
      },
    ],
    selectProject: mocks.selectProject,
  }),
}));

vi.mock('@/features/environment-tracker', () => ({
  useEnvironmentsQuery: () => ({ data: [] }),
}));

vi.mock('../hooks/use-search', () => ({
  useClearSearchHistoryMutation: () => ({
    isPending: false,
    mutateAsync: mocks.clearHistory,
  }),
  useDeleteSearchHistoryMutation: () => ({
    isPending: false,
    mutateAsync: mocks.deleteHistory,
  }),
  useRecordSearchHistoryMutation: () => ({
    mutateAsync: mocks.recordHistory,
  }),
  useSearchHistoryQuery: () => ({
    data: [
      {
        createdAt: '2026-08-09T00:00:00.000Z',
        id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        request: { ...DEFAULT_SEARCH_REQUEST, query: 'previous query' },
      },
    ],
  }),
  useSearchQuery: (request: unknown) => {
    mocks.searchQuery(request);
    if (mocks.searchState.mode === 'pending') {
      return {
        data: undefined,
        isError: false,
        isFetching: true,
        isPending: true,
      };
    }
    if (mocks.searchState.mode === 'error') {
      return {
        data: undefined,
        isError: true,
        isFetching: false,
        isPending: false,
      };
    }
    return {
      data: {
        hasMore: false,
        items: [],
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 0,
      },
      isError: false,
      isFetching: false,
      isPending: false,
    };
  },
}));

describe('GlobalSearchPage', () => {
  beforeEach(() => {
    mocks.searchState.mode = 'data';
    vi.clearAllMocks();
  });

  it('debounces metadata input and restores an explicitly saved search', async () => {
    mocks.recordHistory.mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <GlobalSearchPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText('Search metadata');
    await user.type(input, 'logo');
    await waitFor(
      () =>
        expect(mocks.searchQuery).toHaveBeenLastCalledWith(
          expect.objectContaining({ query: 'logo' }),
        ),
      { timeout: 1_500 },
    );

    await user.click(
      screen.getByRole('button', { name: 'Restore search: previous query' }),
    );
    expect(screen.getByLabelText('Search metadata')).toHaveValue(
      'previous query',
    );
    expect(mocks.recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'previous query' }),
    );
  });

  it('renders scoped loading and safe storage error states', () => {
    mocks.searchState.mode = 'pending';
    const { unmount } = renderWithProviders(
      <MemoryRouter>
        <GlobalSearchPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('status', { name: 'Searching metadata' }),
    ).toBeVisible();
    unmount();

    mocks.searchState.mode = 'error';
    renderWithProviders(
      <MemoryRouter>
        <GlobalSearchPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Search is unavailable',
    );
    expect(
      screen.queryByText(/SQLite|SELECT|database operation/i),
    ).not.toBeInTheDocument();
  });
});
