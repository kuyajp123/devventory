import type { ReactNode } from 'react';
import { formatReleaseNotes } from '../utils/format-release-notes';
import { parseReleaseNotes } from '../utils/parse-release-notes';

function renderInlineFormattedText(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong className="font-bold text-foreground" key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-foreground"
          key={index}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function ReleaseNotesContent({ notes }: { notes?: string | null }) {
  const formatted = formatReleaseNotes(notes);
  const sections = parseReleaseNotes(formatted);

  if (sections.length === 0) {
    return (
      <p className="text-xs text-muted">
        Includes bug fixes and performance improvements.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      {sections.map((section, sectionIdx) => (
        <div className="space-y-2" key={sectionIdx}>
          {section.title && (
            <h4 className="font-mono text-xs font-semibold text-foreground">
              {section.title}
            </h4>
          )}
          <div className="space-y-1.5">
            {section.items.map((item, itemIdx) =>
              item.type === 'list-item' ? (
                <div
                  className="flex items-start gap-2 text-foreground/90 leading-relaxed"
                  key={itemIdx}
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
                  <span className="min-w-0 flex-1">
                    {renderInlineFormattedText(item.text)}
                  </span>
                </div>
              ) : (
                <p className="text-foreground/90 leading-relaxed" key={itemIdx}>
                  {renderInlineFormattedText(item.text)}
                </p>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
