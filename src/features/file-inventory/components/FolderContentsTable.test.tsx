import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { IndexedFile } from '../models/file-inventory';
import { FolderContentsTable } from './FolderContentsTable';

describe('FolderContentsTable status presentation', () => {
  it('renders available and active as success while missing remains a warning', () => {
    renderWithProviders(
      <FolderContentsTable
        files={[activeFile, missingFile]}
        hasFilters={false}
        isFetching={false}
        isLoading={false}
        onNavigateFolder={vi.fn()}
        onSelectFile={vi.fn()}
        onSortChange={vi.fn()}
        selectedFileId={undefined}
        sortBy="relativePath"
        sortDirection="ascending"
        subfolders={[
          {
            isWatched: false,
            name: 'src',
            relativePath: 'src',
          },
        ]}
      />,
    );

    expectStatusTone('Available', 'success');
    expectStatusTone('Active', 'success');
    expectStatusTone('Missing', 'warning');
  });

  it('renders markdown preview button for .md files and calls onPreviewMarkdown', async () => {
    const handlePreviewMarkdown = vi.fn();
    renderWithProviders(
      <FolderContentsTable
        files={[markdownFile]}
        hasFilters={false}
        isFetching={false}
        isLoading={false}
        onNavigateFolder={vi.fn()}
        onPreviewMarkdown={handlePreviewMarkdown}
        onSelectFile={vi.fn()}
        onSortChange={vi.fn()}
        selectedFileId={undefined}
        sortBy="relativePath"
        sortDirection="ascending"
        subfolders={[]}
      />,
    );

    const previewBtn = screen.getByRole('button', {
      name: `Preview markdown for ${markdownFile.name}`,
    });
    expect(previewBtn).toBeInTheDocument();

    previewBtn.click();
    expect(handlePreviewMarkdown).toHaveBeenCalledWith(markdownFile);
  });

  it('calls onSelectFile when clicking a file row', async () => {
    const handleSelectFile = vi.fn();
    renderWithProviders(
      <FolderContentsTable
        files={[markdownFile]}
        hasFilters={false}
        isFetching={false}
        isLoading={false}
        onNavigateFolder={vi.fn()}
        onSelectFile={handleSelectFile}
        onSortChange={vi.fn()}
        selectedFileId={undefined}
        sortBy="relativePath"
        sortDirection="ascending"
        subfolders={[]}
      />,
    );

    const cell = screen.getByText('README.md');
    cell.click();
    expect(handleSelectFile).toHaveBeenCalledWith(markdownFile);
  });
});

function expectStatusTone(label: string, tone: 'success' | 'warning') {
  const chip = screen.getByText(label).closest('[data-slot="chip"]');
  expect(chip).toHaveAttribute('data-status-tone', tone);
  expect(chip).toHaveClass(
    tone === 'success' ? 'bg-success/15' : 'bg-warning/15',
    tone === 'success' ? 'text-success' : 'text-warning',
  );
}

const activeFile: IndexedFile = {
  category: 'source',
  extension: 'ts',
  firstSeenAt: '2026-08-02T00:00:00.000Z',
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  lastSeenAt: '2026-08-02T00:00:00.000Z',
  mimeType: 'video/mp2t',
  modifiedAtMs: 1_775_257_200_000,
  name: 'main.ts',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  relativePath: 'src/main.ts',
  sizeBytes: 1_536,
  sourceType: 'discovered',
  status: 'active',
  updatedAt: '2026-08-02T00:00:00.000Z',
  watchedLocationId: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
};

const missingFile: IndexedFile = {
  ...activeFile,
  id: '56794b0d-d130-4be4-8479-607f3aad826c',
  name: 'missing.ts',
  relativePath: 'src/missing.ts',
  status: 'missing',
};

const markdownFile: IndexedFile = {
  ...activeFile,
  category: 'document',
  extension: 'md',
  id: '98765432-d130-4be4-8479-607f3aad826c',
  name: 'README.md',
  relativePath: 'README.md',
};
