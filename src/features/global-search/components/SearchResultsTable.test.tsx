import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_SEARCH_REQUEST, type SearchResult } from '../models/search';
import { SearchResultsTable } from './SearchResultsTable';

const result = {
  category: 'image',
  extension: 'png',
  id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  modifiedAtMs: 1_770_000_000_000,
  name: 'logo-dark.png',
  note: 'Primary brand asset',
  origin: 'managed',
  projectId: 'ab89c0c5-7749-41cb-9394-e884454f5077',
  projectName: 'Devventory',
  relativePath: 'assets/branding/logo-dark.png',
  resultType: 'file',
  status: 'active',
  tags: ['brand'],
} satisfies SearchResult;

describe('SearchResultsTable', () => {
  it('renders the bounded page and delegates server sorting and opening', async () => {
    const onRequestChange = vi.fn();
    const onOpenResult = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsTable
        isFetching={false}
        items={[result]}
        onOpenResult={onOpenResult}
        onRequestChange={onRequestChange}
        request={DEFAULT_SEARCH_REQUEST}
        totalItems={143}
        totalPages={6}
      />,
    );

    expect(screen.getByText('assets/branding/logo-dark.png')).toBeVisible();
    expect(screen.getByText('143 matching results')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /sort by name/i }));
    expect(onRequestChange).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        sortBy: 'name',
        sortDirection: 'ascending',
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Open logo-dark.png' }),
    );
    expect(onOpenResult).toHaveBeenCalledWith(result);
    await user.click(screen.getByRole('button', { name: /^2$/ }));
    expect(onRequestChange).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('shows explicit loading and empty states without rendering an unbounded table', () => {
    const sharedProps = {
      items: [],
      onOpenResult: vi.fn(),
      onRequestChange: vi.fn(),
      request: DEFAULT_SEARCH_REQUEST,
      totalItems: 0,
      totalPages: 0,
    };
    const { rerender } = renderWithProviders(
      <SearchResultsTable {...sharedProps} isFetching />,
    );
    expect(
      screen.getByRole('status', { name: 'Searching metadata' }),
    ).toBeVisible();
    rerender(<SearchResultsTable {...sharedProps} isFetching={false} />);
    expect(screen.getByText('No metadata matched')).toBeVisible();
  });
});
