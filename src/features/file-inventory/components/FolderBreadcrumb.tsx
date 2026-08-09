import { IconChevronRight } from '@tabler/icons-react';

interface FolderBreadcrumbProps {
  segments: ReadonlyArray<{ name: string; path: string }>;
  onNavigate: (folderPath: string) => void;
}

export function FolderBreadcrumb({
  segments,
  onNavigate,
}: FolderBreadcrumbProps) {
  return (
    <nav
      aria-label="Folder breadcrumb"
      className="flex min-h-8 items-center gap-1 overflow-x-auto px-3 py-1.5 text-xs"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span className="flex items-center gap-1" key={segment.path}>
            {index > 0 && (
              <IconChevronRight
                aria-hidden="true"
                className="shrink-0 text-muted"
                size={12}
              />
            )}
            {isLast ? (
              <span
                aria-current="location"
                className="truncate font-mono font-medium text-foreground"
              >
                {segment.name}
              </span>
            ) : (
              <button
                className="truncate rounded-sm font-mono text-muted transition-colors hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent"
                onClick={() => onNavigate(segment.path)}
                type="button"
              >
                {segment.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
