import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownViewer } from './MarkdownViewer';

describe('MarkdownViewer', () => {
  const sampleMarkdown = `
# Project Overview

This is a **bold** paragraph with a [link](https://example.com).

## Features
- Feature A
- Feature B

\`\`\`typescript
const greeting = "hello world";
\`\`\`

| Column 1 | Column 2 |
| -------- | -------- |
| Value A  | Value B  |
`;

  it('renders markdown elements in rendered view mode', () => {
    render(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /project overview/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /features/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Feature A')).toBeInTheDocument();
    expect(screen.getByText('Feature B')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Value A')).toBeInTheDocument();
  });

  it('renders raw lines and line numbers in raw view mode', () => {
    render(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="raw"
      />,
    );

    expect(screen.getByLabelText('Raw Markdown content')).toBeInTheDocument();
    // Line 1 is empty in sampleMarkdown, line 2 has # Project Overview
    expect(screen.getByText('# Project Overview')).toBeInTheDocument();
    // Verify line numbers exist
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('highlights search queries in raw view mode and marks active match', () => {
    const handleMatchCountChange = vi.fn();
    render(
      <MarkdownViewer
        activeMatchIndex={0}
        content={sampleMarkdown}
        onMatchCountChange={handleMatchCountChange}
        relativePath="docs/overview.md"
        searchQuery="Features"
        sizeBytes={sampleMarkdown.length}
        viewMode="raw"
      />,
    );

    const mark = screen.getByText('Features');
    expect(mark.tagName).toBe('MARK');
    expect(mark).toHaveAttribute('data-markdown-match', 'true');
    expect(mark).toHaveAttribute('data-active-match', 'true');
    expect(handleMatchCountChange).toHaveBeenCalledWith(1);
  });

  it('highlights search queries in rendered view mode and supports active match navigation', () => {
    const handleMatchCountChange = vi.fn();
    const { rerender } = render(
      <MarkdownViewer
        activeMatchIndex={0}
        content={sampleMarkdown}
        onMatchCountChange={handleMatchCountChange}
        relativePath="docs/overview.md"
        searchQuery="Feature"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
      />,
    );

    const marks = screen.getAllByText('Feature');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks[0]).toHaveAttribute('data-active-match', 'true');
    expect(marks[1]).not.toHaveAttribute('data-active-match');

    // Switch active match index to 1
    rerender(
      <MarkdownViewer
        activeMatchIndex={1}
        content={sampleMarkdown}
        onMatchCountChange={handleMatchCountChange}
        relativePath="docs/overview.md"
        searchQuery="Feature"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
      />,
    );

    expect(marks[0]).not.toHaveAttribute('data-active-match');
    expect(marks[1]).toHaveAttribute('data-active-match', 'true');
  });

  it('applies zoomLevel styling to content wrapper in both rendered and raw modes', () => {
    const { rerender } = render(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
        zoomLevel={130}
      />,
    );

    const renderedContainer = screen.getByLabelText(
      'Rendered Markdown content',
    );
    const renderedWrapper = renderedContainer.firstElementChild as HTMLElement;
    expect(renderedWrapper.style.zoom).toBe('1.3');

    rerender(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="raw"
        zoomLevel={150}
      />,
    );

    const rawContainer = screen.getByLabelText('Raw Markdown content');
    const rawWrapper = rawContainer.firstElementChild as HTMLElement;
    expect(rawWrapper.style.zoom).toBe('1.5');
  });

  it('shows safety warning banner when file size exceeds 2 MB limit', async () => {
    const user = userEvent.setup();
    const handleOpenInVsCode = vi.fn();
    const twoMegabytesAndOne = 2 * 1024 * 1024 + 1;

    render(
      <MarkdownViewer
        content="massive content"
        onOpenInVsCode={handleOpenInVsCode}
        relativePath="large-dump.md"
        sizeBytes={twoMegabytesAndOne}
        viewMode="rendered"
      />,
    );

    expect(screen.getByText('File too large to preview')).toBeInTheDocument();
    expect(
      screen.getByText(/exceeds the 2 MB safe preview limit/i),
    ).toBeInTheDocument();

    const vsCodeBtn = screen.getByRole('button', { name: /open in vs code/i });
    expect(vsCodeBtn).toBeInTheDocument();

    await user.click(vsCodeBtn);
    expect(handleOpenInVsCode).toHaveBeenCalledTimes(1);
  });

  it('enables text selection in both rendered and raw view modes', () => {
    const { rerender } = render(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
      />,
    );

    const renderedContainer = screen.getByLabelText(
      'Rendered Markdown content',
    );
    expect(renderedContainer).toHaveClass('select-text');

    rerender(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="raw"
      />,
    );

    const rawContainer = screen.getByLabelText('Raw Markdown content');
    expect(rawContainer).toHaveClass('select-text');
  });

  it('renders a copy button on code snippets and copies code to clipboard', async () => {
    const user = userEvent.setup();
    const clipboardSpy = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();

    render(
      <MarkdownViewer
        content={sampleMarkdown}
        relativePath="docs/overview.md"
        sizeBytes={sampleMarkdown.length}
        viewMode="rendered"
      />,
    );

    const copyBtn = screen.getByRole('button', { name: /copy code snippet/i });
    expect(copyBtn).toBeInTheDocument();

    await user.click(copyBtn);
    expect(clipboardSpy).toHaveBeenCalledWith(
      'const greeting = "hello world";',
    );
    expect(
      screen.getByRole('button', { name: /code copied/i }),
    ).toBeInTheDocument();
  });

  it('highlights search matches even when rendered inside an ancestor with select-none class', () => {
    const handleMatchCountChange = vi.fn();
    render(
      <div className="app-shell select-none">
        <MarkdownViewer
          activeMatchIndex={0}
          content="# Devventory engineering rules\n\nAsset Library frontend"
          onMatchCountChange={handleMatchCountChange}
          relativePath="docs/overview.md"
          searchQuery="Devventory"
          sizeBytes={100}
          viewMode="rendered"
        />
      </div>,
    );

    const mark = screen.getByText('Devventory');
    expect(mark.tagName).toBe('MARK');
    expect(mark).toHaveAttribute('data-active-match', 'true');
    expect(handleMatchCountChange).toHaveBeenCalledWith(1);
  });

  it('reproduces switching files and toggling to raw mode without crashing', () => {
    const file1 =
      '# Devventory\n\nDevventory is an offline-first Tauri desktop application.\n\n- `npm run dev` starts the browser development server.\n\n```powershell\nnpm ci\n```';
    const file2 =
      '# Devventory engineering rules\n\n## Scope\n\n- Keep the application offline-first.\n- Reuse the existing application state.\n\n```text\nsrc/\n├── app/\n```';

    const { rerender } = render(
      <MarkdownViewer
        content={file1}
        relativePath="README.md"
        sizeBytes={file1.length}
        viewMode="rendered"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /devventory/i }),
    ).toBeInTheDocument();

    rerender(
      <MarkdownViewer
        content={file2}
        relativePath="AGENTS.md"
        sizeBytes={file2.length}
        viewMode="rendered"
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /devventory engineering rules/i,
      }),
    ).toBeInTheDocument();

    expect(() => {
      rerender(
        <MarkdownViewer
          content={file2}
          relativePath="AGENTS.md"
          sizeBytes={file2.length}
          viewMode="raw"
        />,
      );
    }).not.toThrow();

    expect(screen.getByLabelText('Raw Markdown content')).toBeInTheDocument();
  });

  it('safely toggles between rendered and raw modes when searching and clearing queries', () => {
    const handleMatchCountChange = vi.fn();
    const content =
      '# Search Title\n\nSearchable text with **bold** and `code`.';

    const { rerender } = render(
      <MarkdownViewer
        activeMatchIndex={0}
        content={content}
        onMatchCountChange={handleMatchCountChange}
        relativePath="doc.md"
        searchQuery="Search"
        sizeBytes={content.length}
        viewMode="rendered"
      />,
    );

    const marks = screen.getAllByText('Search');
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0].tagName).toBe('MARK');

    // Switch to raw mode while search query is active
    rerender(
      <MarkdownViewer
        activeMatchIndex={0}
        content={content}
        onMatchCountChange={handleMatchCountChange}
        relativePath="doc.md"
        searchQuery="Search"
        sizeBytes={content.length}
        viewMode="raw"
      />,
    );

    expect(screen.getByLabelText('Raw Markdown content')).toBeInTheDocument();

    // Switch back to rendered mode and clear search query
    rerender(
      <MarkdownViewer
        activeMatchIndex={0}
        content={content}
        onMatchCountChange={handleMatchCountChange}
        relativePath="doc.md"
        searchQuery=""
        sizeBytes={content.length}
        viewMode="rendered"
      />,
    );

    expect(
      screen.getByLabelText('Rendered Markdown content'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText((_content, element) => element?.tagName === 'MARK'),
    ).not.toBeInTheDocument();
  });

  it('does not touch DOM when search query is empty and no marks exist', () => {
    const content = '# Title\n\nParagraph text.';
    render(
      <MarkdownViewer
        content={content}
        relativePath="doc.md"
        sizeBytes={content.length}
        viewMode="rendered"
      />,
    );

    const renderedContainer = screen.getByLabelText(
      'Rendered Markdown content',
    );
    // Ensure no marks were inserted
    expect(renderedContainer.querySelectorAll('mark')).toHaveLength(0);
  });
});
