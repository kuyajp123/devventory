export interface ReleaseNoteItem {
  type: 'list-item' | 'paragraph';
  text: string;
}

export interface ReleaseSection {
  title?: string;
  items: ReleaseNoteItem[];
}

export function parseReleaseNotes(text: string): ReleaseSection[] {
  const lines = text.split(/\r?\n/);
  const sections: ReleaseSection[] = [];
  let currentSection: ReleaseSection = { items: [] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      if (currentSection.title || currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        title: headingMatch[1].trim(),
        items: [],
      };
      continue;
    }

    const listMatch = line.match(/^[-*�]\s+(.+)$/);
    if (listMatch) {
      currentSection.items.push({
        type: 'list-item',
        text: listMatch[1].trim(),
      });
      continue;
    }

    currentSection.items.push({
      type: 'paragraph',
      text: line,
    });
  }

  if (currentSection.title || currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}
