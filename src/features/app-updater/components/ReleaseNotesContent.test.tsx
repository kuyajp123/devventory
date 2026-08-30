import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseReleaseNotes } from '../utils/parse-release-notes';
import { ReleaseNotesContent } from './ReleaseNotesContent';

describe('ReleaseNotesContent', () => {
  it('renders fallback text when notes are null or empty', () => {
    render(<ReleaseNotesContent notes={null} />);
    expect(
      screen.getByText('Includes bug fixes and performance improvements.'),
    ).toBeInTheDocument();
  });

  it('renders structured sections, headers, and bullet items', () => {
    const rawMarkdown = `
### Features & Improvements
- Quick secret reveal & **one-click copy** in Environment Tracker
- Smooth auto-scroll and centering in Credential Vault

### Bug Fixes
- Fixed \`tags\` and notes in Edit Asset Metadata dialog
    `;

    render(<ReleaseNotesContent notes={rawMarkdown} />);

    expect(screen.getByText('Features & Improvements')).toBeInTheDocument();
    expect(screen.getByText('Bug Fixes')).toBeInTheDocument();
    expect(screen.getByText('one-click copy')).toHaveClass('font-bold');
    expect(screen.getByText('tags')).toHaveClass('font-mono');
    expect(
      screen.getByText(/Smooth auto-scroll and centering in Credential Vault/),
    ).toBeInTheDocument();
  });

  it('handles plain paragraphs gracefully', () => {
    const text = `
Important notice about this release.
Please restart the app after updating.
    `;
    render(<ReleaseNotesContent notes={text} />);

    expect(
      screen.getByText('Important notice about this release.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Please restart the app after updating.'),
    ).toBeInTheDocument();
  });
});

describe('parseReleaseNotes', () => {
  it('parses markdown headings and list items into structured sections', () => {
    const input = `
### Section 1
- Item 1
- Item 2

### Section 2
- Item 3
Paragraph text
    `;
    const result = parseReleaseNotes(input);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Section 1');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].title).toBe('Section 2');
    expect(result[1].items).toHaveLength(2);
  });
});
