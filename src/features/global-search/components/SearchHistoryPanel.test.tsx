import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_SEARCH_REQUEST } from '../models/search';
import { SearchHistoryPanel } from './SearchHistoryPanel';

describe('SearchHistoryPanel', () => {
  it('restores, deletes, and clears bounded history entries explicitly', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onDelete = vi.fn();
    const onRestore = vi.fn();
    const request = {
      ...DEFAULT_SEARCH_REQUEST,
      origins: ['managed' as const],
      query: 'logo',
    };
    renderWithProviders(
      <SearchHistoryPanel
        history={[
          {
            createdAt: '2026-08-09T00:00:00.000Z',
            id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
            request,
          },
        ]}
        isBusy={false}
        onClear={onClear}
        onDelete={onDelete}
        onRestore={onRestore}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Restore search: logo' }),
    );
    expect(onRestore).toHaveBeenCalledWith(request);
    await user.click(
      screen.getByRole('button', { name: 'Remove logo from search history' }),
    );
    expect(onDelete).toHaveBeenCalledWith(
      '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
