import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { assetLibraryGateway } from '@/features/asset-library/services/asset-library.gateway';
import { fileInventoryGateway } from '../services/file-inventory.gateway';
import type { IndexedFile } from '../models/file-inventory';
import { MarkdownPreviewDrawer } from './MarkdownPreviewDrawer';

vi.mock('../services/file-inventory.gateway', () => ({
  fileInventoryGateway: {
    readProjectFileContent: vi.fn(),
  },
}));

vi.mock('@/features/asset-library/services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    runAction: vi.fn(),
  },
}));

describe('MarkdownPreviewDrawer', () => {
  const mockFile: IndexedFile = {
    category: 'document',
    extension: 'md',
    firstSeenAt: '2026-08-01T00:00:00.000Z',
    id: 'f1-test-id',
    lastSeenAt: '2026-08-01T00:00:00.000Z',
    mimeType: 'text/markdown',
    modifiedAtMs: 1_700_000_000_000,
    name: 'README.md',
    projectId: 'p1-test-id',
    relativePath: 'README.md',
    sizeBytes: 120,
    sourceType: 'discovered',
    status: 'active',
    updatedAt: '2026-08-01T00:00:00.000Z',
    watchedLocationId: 'w1',
  };

  const sampleContent =
    '# Welcome to Devventory\n\nThis is a local asset manager.';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fileInventoryGateway.readProjectFileContent).mockResolvedValue({
      content: sampleContent,
      fileId: mockFile.id,
      modifiedAtMs: mockFile.modifiedAtMs,
      relativePath: mockFile.relativePath,
      sizeBytes: sampleContent.length,
    });
  });

  it('renders drawer header with file name and loads content', async () => {
    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'README.md' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: /welcome to devventory/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it('toggles between rendered and raw mode', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const rawButton = screen.getByRole('button', { name: /^raw$/i });
    await user.click(rawButton);

    expect(screen.getByLabelText('Raw Markdown content')).toBeInTheDocument();
    expect(screen.getByText('# Welcome to Devventory')).toBeInTheDocument();

    const renderedButton = screen.getByRole('button', { name: /^rendered$/i });
    await user.click(renderedButton);

    expect(
      screen.getByLabelText('Rendered Markdown content'),
    ).toBeInTheDocument();
  });

  it('opens in-document search and computes match counts', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const searchButton = screen.getByRole('button', {
      name: /find in document/i,
    });
    await user.click(searchButton);

    const searchInput = screen.getByPlaceholderText('Find in document...');
    expect(searchInput).toBeInTheDocument();

    await user.type(searchInput, 'Devventory');
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
  });

  it('navigates search matches with arrow buttons and Enter key', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const searchButton = screen.getByRole('button', {
      name: /find in document/i,
    });
    await user.click(searchButton);

    const searchInput = screen.getByPlaceholderText('Find in document...');
    await user.type(searchInput, 'is');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /next match/i });
    const prevBtn = screen.getByRole('button', { name: /previous match/i });

    await user.click(nextBtn);
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    await user.click(prevBtn);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    // Test Enter key on search input
    await user.type(searchInput, '{Enter}');
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    // Test Shift+Enter key on search input
    await user.type(searchInput, '{Shift>}{Enter}{/Shift}');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('increases, decreases, and resets zoom level with minimum boundary at 100%', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const zoomOutBtn = screen.getByRole('button', { name: /decrease zoom/i });
    const zoomInBtn = screen.getByRole('button', { name: /increase zoom/i });
    const zoomIndicator = screen.getByRole('button', { name: /100%/i });

    // Minimum boundary: zoom out is disabled at 100%
    expect(zoomOutBtn).toBeDisabled();
    expect(zoomIndicator).toHaveTextContent('100%');

    // Zoom in to 110%
    await user.click(zoomInBtn);
    expect(screen.getByRole('button', { name: /110%/i })).toHaveTextContent(
      '110%',
    );
    expect(zoomOutBtn).toBeEnabled();

    // Zoom in to 120%
    await user.click(zoomInBtn);
    expect(screen.getByRole('button', { name: /120%/i })).toHaveTextContent(
      '120%',
    );

    // Zoom out back to 110%
    await user.click(zoomOutBtn);
    expect(screen.getByRole('button', { name: /110%/i })).toHaveTextContent(
      '110%',
    );

    // Reset button appears when zoom > 100%
    const resetBtn = screen.getByRole('button', {
      name: /reset zoom to default/i,
    });
    await user.click(resetBtn);
    expect(screen.getByRole('button', { name: /100%/i })).toHaveTextContent(
      '100%',
    );
    expect(zoomOutBtn).toBeDisabled();
  });

  it('copies markdown to clipboard on Copy button click', async () => {
    const user = userEvent.setup();
    const clipboardSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const copyButton = screen.getByRole('button', { name: /copy markdown/i });
    await user.click(copyButton);

    expect(clipboardSpy).toHaveBeenCalledWith(sampleContent);
  });

  it('triggers VS Code open action', async () => {
    const user = userEvent.setup();
    vi.mocked(assetLibraryGateway.runAction).mockResolvedValue(
      'Opened in VS Code',
    );

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    const vsCodeButton = screen.getByRole('button', {
      name: /open in vs code/i,
    });
    await user.click(vsCodeButton);

    expect(assetLibraryGateway.runAction).toHaveBeenCalledWith(
      'p1-test-id',
      mockFile.id,
      'open_in_vscode',
    );
  });

  it('toggles maximized mode on maximize/restore button click', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    const drawerAside = screen.getByRole('complementary', {
      name: `Markdown preview for ${mockFile.name}`,
    });
    expect(drawerAside).not.toHaveClass('fixed inset-0');

    const expandButton = screen.getByRole('button', {
      name: /expand to full view/i,
    });
    await user.click(expandButton);

    expect(drawerAside).toHaveClass('fixed inset-0');

    const restoreButton = screen.getByRole('button', {
      name: /restore to drawer/i,
    });
    await user.click(restoreButton);

    expect(drawerAside).not.toHaveClass('fixed inset-0');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={handleClose}
        projectId="p1-test-id"
      />,
    );

    const closeButton = screen.getByRole('button', {
      name: /close markdown preview/i,
    });
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('updates displayed content when switching to a different file', async () => {
    const mockFile2: IndexedFile = {
      ...mockFile,
      id: 'f2-test-id',
      name: 'CHANGELOG.md',
      relativePath: 'CHANGELOG.md',
    };
    const changelogContent = '# Changelog\n\n- Initial release.';

    vi.mocked(fileInventoryGateway.readProjectFileContent).mockImplementation(
      async (_projId, fileId) => {
        if (fileId === 'f2-test-id') {
          return {
            content: changelogContent,
            fileId: mockFile2.id,
            modifiedAtMs: mockFile2.modifiedAtMs,
            relativePath: mockFile2.relativePath,
            sizeBytes: changelogContent.length,
          };
        }
        return {
          content: sampleContent,
          fileId: mockFile.id,
          modifiedAtMs: mockFile.modifiedAtMs,
          relativePath: mockFile.relativePath,
          sizeBytes: sampleContent.length,
        };
      },
    );

    const { rerender } = renderWithProviders(
      <MarkdownPreviewDrawer
        file={mockFile}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome to devventory/i)).toBeInTheDocument();
    });

    rerender(
      <MarkdownPreviewDrawer
        file={mockFile2}
        key={mockFile2.id}
        onClose={vi.fn()}
        projectId="p1-test-id"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: 'CHANGELOG.md' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/initial release/i)).toBeInTheDocument();
    });
  });
});
