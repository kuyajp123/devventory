import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../models/search';
import { SearchResultInspector } from './SearchResultInspector';

const sampleResult: SearchResult = {
  category: 'source',
  extension: 'ts',
  id: 'file-123',
  modifiedAtMs: new Date('2026-08-01T12:00:00.000Z').getTime(),
  name: 'AppLayout.tsx',
  note: null,
  origin: 'managed',
  projectId: 'proj-1',
  projectName: 'Devventory',
  relativePath: 'src/app/layouts/AppLayout.tsx',
  resultType: 'file',
  status: 'active',
  tags: ['ui', 'layout'],
};

describe('SearchResultInspector', () => {
  it('renders result details and handles open, copy, and close actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenResult = vi.fn();

    renderWithProviders(
      <SearchResultInspector
        onClose={onClose}
        onOpenResult={onOpenResult}
        result={sampleResult}
      />,
    );

    expect(screen.getByText('AppLayout.tsx')).toBeInTheDocument();
    expect(screen.getByText('Devventory')).toBeInTheDocument();
    expect(
      screen.getByText('src/app/layouts/AppLayout.tsx'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenResult).toHaveBeenCalledWith(sampleResult);

    await user.click(
      screen.getByRole('button', { name: 'Close details inspector' }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
