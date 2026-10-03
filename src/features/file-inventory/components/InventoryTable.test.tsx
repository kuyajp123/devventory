import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { IndexedFile } from '../models/file-inventory';
import { InventoryTable } from './InventoryTable';

describe('InventoryTable', () => {
  const tsFile: IndexedFile = {
    category: 'source',
    extension: 'ts',
    firstSeenAt: '2026-08-02T00:00:00.000Z',
    id: 'f1',
    lastSeenAt: '2026-08-02T00:00:00.000Z',
    mimeType: 'video/mp2t',
    modifiedAtMs: 1_775_257_200_000,
    name: 'main.ts',
    projectId: 'p1',
    relativePath: 'src/main.ts',
    sizeBytes: 1024,
    sourceType: 'discovered',
    status: 'active',
    updatedAt: '2026-08-02T00:00:00.000Z',
    watchedLocationId: 'w1',
  };

  const mdFile: IndexedFile = {
    category: 'document',
    extension: 'md',
    firstSeenAt: '2026-08-02T00:00:00.000Z',
    id: 'f2',
    lastSeenAt: '2026-08-02T00:00:00.000Z',
    mimeType: 'text/markdown',
    modifiedAtMs: 1_775_257_200_000,
    name: 'README.md',
    projectId: 'p1',
    relativePath: 'README.md',
    sizeBytes: 2048,
    sourceType: 'discovered',
    status: 'active',
    updatedAt: '2026-08-02T00:00:00.000Z',
    watchedLocationId: 'w1',
  };

  it('renders markdown preview button for md files and calls onPreviewMarkdown on click', async () => {
    const user = userEvent.setup();
    const handlePreviewMarkdown = vi.fn();

    renderWithProviders(
      <InventoryTable
        files={[tsFile, mdFile]}
        hasFilters={false}
        onPreviewMarkdown={handlePreviewMarkdown}
        onSortChange={vi.fn()}
        sortBy="relativePath"
        sortDirection="ascending"
      />,
    );

    // Should NOT have preview button for tsFile
    expect(
      screen.queryByRole('button', {
        name: `Preview markdown for ${tsFile.name}`,
      }),
    ).not.toBeInTheDocument();

    // Should have preview button for mdFile
    const previewBtn = screen.getByRole('button', {
      name: `Preview markdown for ${mdFile.name}`,
    });
    expect(previewBtn).toBeInTheDocument();

    await user.click(previewBtn);
    expect(handlePreviewMarkdown).toHaveBeenCalledWith(mdFile);
  });

  it('calls onSelectFile when clicking a row', async () => {
    const handleSelectFile = vi.fn();

    renderWithProviders(
      <InventoryTable
        files={[tsFile, mdFile]}
        hasFilters={false}
        onSelectFile={handleSelectFile}
        onSortChange={vi.fn()}
        selectedFileId={mdFile.id}
        sortBy="relativePath"
        sortDirection="ascending"
      />,
    );

    const cell = screen.getAllByText('README.md')[0];
    cell.click();
    expect(handleSelectFile).toHaveBeenCalledWith(mdFile);
  });
});
