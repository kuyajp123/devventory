import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { markdownReaderGateway } from '../services/markdown-reader.gateway';
import { StandaloneMarkdownReader } from './StandaloneMarkdownReader';

vi.mock('../services/markdown-reader.gateway', () => ({
  markdownReaderGateway: {
    getDocument: vi.fn(),
    onDocumentChanged: vi.fn().mockResolvedValue(() => undefined),
  },
}));

describe('StandaloneMarkdownReader', () => {
  const sampleDocument = {
    content: '# Architecture Guide\n\nDevventory is offline-first.',
    fileName: 'ARCHITECTURE.md',
    modifiedAtMs: 1_700_000_000_000,
    path: 'C:/projects/devventory/ARCHITECTURE.md',
    sizeBytes: 52,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially while fetching document', () => {
    vi.mocked(markdownReaderGateway.getDocument).mockReturnValue(
      new Promise(() => {}),
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    expect(
      screen.getByLabelText('Loading Markdown document'),
    ).toBeInTheDocument();
  });

  it('renders document header, metadata, and rendered markdown', async () => {
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'ARCHITECTURE.md',
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('52 B')).toBeInTheDocument();
    expect(screen.getByText(sampleDocument.path)).toBeInTheDocument();
    expect(
      screen.getByText(/devventory is offline-first/i),
    ).toBeInTheDocument();
  });

  it('renders error alert when document cannot be loaded', async () => {
    vi.mocked(markdownReaderGateway.getDocument).mockRejectedValue(
      new Error('File not found'),
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText('Markdown document unavailable'),
      ).toBeInTheDocument();
    });
  });

  it('toggles between rendered and raw view modes', async () => {
    const user = userEvent.setup();
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Rendered Markdown content'),
      ).toBeInTheDocument();
    });

    const rawBtn = screen.getByRole('button', { name: /^raw$/i });
    await user.click(rawBtn);

    expect(screen.getByLabelText('Raw Markdown content')).toBeInTheDocument();
    expect(screen.getByText('# Architecture Guide')).toBeInTheDocument();

    const renderedBtn = screen.getByRole('button', { name: /^rendered$/i });
    await user.click(renderedBtn);

    expect(
      screen.getByLabelText('Rendered Markdown content'),
    ).toBeInTheDocument();
  });

  it('finds and navigates search matches within the document', async () => {
    const user = userEvent.setup();
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'ARCHITECTURE.md',
        }),
      ).toBeInTheDocument();
    });

    const searchToggle = screen.getByRole('button', {
      name: /find in document/i,
    });
    await user.click(searchToggle);

    const searchInput = screen.getByPlaceholderText('Find in document...');
    await user.type(searchInput, 'Devventory');

    expect(screen.getByText('1 of 1')).toBeInTheDocument();

    const closeSearchBtn = screen.getByRole('button', {
      name: /close search/i,
    });
    await user.click(closeSearchBtn);

    expect(
      screen.queryByPlaceholderText('Find in document...'),
    ).not.toBeInTheDocument();
  });

  it('adjusts zoom level and resets to default', async () => {
    const user = userEvent.setup();
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'ARCHITECTURE.md',
        }),
      ).toBeInTheDocument();
    });

    const zoomOutBtn = screen.getByRole('button', { name: /decrease zoom/i });
    const zoomInBtn = screen.getByRole('button', { name: /increase zoom/i });
    const zoomIndicator = screen.getByRole('button', { name: /100%/i });

    expect(zoomOutBtn).toBeDisabled();
    expect(zoomIndicator).toHaveTextContent('100%');

    await user.click(zoomInBtn);
    expect(screen.getByRole('button', { name: /110%/i })).toHaveTextContent(
      '110%',
    );
    expect(zoomOutBtn).toBeEnabled();

    const resetBtn = screen.getByRole('button', {
      name: /reset zoom to default/i,
    });
    await user.click(resetBtn);
    expect(screen.getByRole('button', { name: /100%/i })).toHaveTextContent(
      '100%',
    );
  });

  it('copies markdown content to clipboard', async () => {
    const user = userEvent.setup();
    const clipboardSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'ARCHITECTURE.md',
        }),
      ).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /copy markdown/i });
    await user.click(copyBtn);

    expect(clipboardSpy).toHaveBeenCalledWith(sampleDocument.content);
  });

  it('copies file path to clipboard on path click', async () => {
    const user = userEvent.setup();
    const clipboardSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();
    vi.mocked(markdownReaderGateway.getDocument).mockResolvedValue(
      sampleDocument,
    );

    renderWithProviders(<StandaloneMarkdownReader />);

    await waitFor(() => {
      expect(screen.getByText(sampleDocument.path)).toBeInTheDocument();
    });

    const pathElement = screen.getByText(sampleDocument.path);
    await user.click(pathElement);

    expect(clipboardSpy).toHaveBeenCalledWith(sampleDocument.path);
  });
});
