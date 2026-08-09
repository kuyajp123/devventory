import { memo } from 'react';
import { Button, Spinner } from '@heroui/react';
import {
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconFolder,
  IconFolderOpen,
  IconRefresh,
} from '@tabler/icons-react';
import { useProjectDirectoryQuery } from '../hooks/use-file-inventory';

const NODE_INDENT_PX = 16;

interface ProjectTreeNodeProps {
  depth: number;
  expandedFolders: ReadonlySet<string>;
  isWatched: boolean;
  name: string;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  path: string;
  projectId: string;
  selectedPath: string;
  treeId: string;
}

export const ProjectTreeNode = memo(function ProjectTreeNode({
  depth,
  expandedFolders,
  isWatched,
  name,
  onSelect,
  onToggle,
  path,
  projectId,
  selectedPath,
  treeId,
}: ProjectTreeNodeProps) {
  const isExpanded = expandedFolders.has(path);
  const isSelected = selectedPath === path;
  const directory = useProjectDirectoryQuery(projectId, path, isExpanded);
  const children = directory.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadableCount =
    directory.data?.pages.reduce(
      (total, page) => total + page.entriesUnreadable,
      0,
    ) ?? 0;

  function handleLabelKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' && !isExpanded) {
      event.preventDefault();
      onToggle(path);
    }
    if (event.key === 'ArrowLeft' && isExpanded) {
      event.preventDefault();
      onToggle(path);
    }
  }

  return (
    <li
      aria-expanded={isExpanded}
      aria-label={`${name}${isWatched ? ', watched location' : ''}`}
      aria-selected={isSelected}
      id={`${treeId}-${path === '.' ? 'root' : path}`}
      role="treeitem"
    >
      <div
        className={`flex min-w-0 items-center py-0.5 pr-2 transition-colors ${
          isSelected
            ? 'bg-accent/10 text-accent'
            : 'text-secondary hover:bg-elevated hover:text-foreground'
        }`}
        style={{ paddingLeft: depth * NODE_INDENT_PX + 4 }}
      >
        <button
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${name}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-elevated focus-visible:outline-2 focus-visible:outline-accent"
          onClick={() => onToggle(path)}
          type="button"
        >
          {isExpanded ? (
            <IconChevronDown aria-hidden="true" size={12} />
          ) : (
            <IconChevronRight aria-hidden="true" size={12} />
          )}
        </button>
        <button
          aria-label={name}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-accent"
          onClick={() => onSelect(path)}
          onKeyDown={handleLabelKeyDown}
          type="button"
        >
          {isExpanded ? (
            <IconFolderOpen aria-hidden="true" className="shrink-0" size={16} />
          ) : (
            <IconFolder aria-hidden="true" className="shrink-0" size={16} />
          )}
          <span className="min-w-0 truncate">{name}</span>
          {isWatched && (
            <IconEye
              aria-hidden="true"
              className="ml-auto shrink-0 text-accent"
              size={13}
            />
          )}
        </button>
      </div>

      {isExpanded && (
        <ul role="group">
          {directory.isPending && (
            <li
              aria-label={`Loading folders in ${name}`}
              className="flex items-center gap-2 py-2 text-muted"
              role="status"
              style={{ paddingLeft: (depth + 1) * NODE_INDENT_PX + 12 }}
            >
              <Spinner size="sm" /> Loading folders…
            </li>
          )}
          {directory.isError && (
            <li
              className="space-y-1 py-2 pr-2 text-danger"
              style={{ paddingLeft: (depth + 1) * NODE_INDENT_PX + 12 }}
            >
              <p>This directory could not be read.</p>
              <Button
                onPress={() => void directory.refetch()}
                size="sm"
                variant="ghost"
              >
                <IconRefresh aria-hidden="true" size={13} /> Retry
              </Button>
            </li>
          )}
          {!directory.isPending &&
            !directory.isError &&
            unreadableCount > 0 && (
              <li
                className="py-1 pr-2 text-warning"
                style={{ paddingLeft: (depth + 1) * NODE_INDENT_PX + 12 }}
              >
                Some folder entries could not be read.
              </li>
            )}
          {children.map((child) => (
            <ProjectTreeNode
              depth={depth + 1}
              expandedFolders={expandedFolders}
              isWatched={child.isWatched}
              key={child.relativePath}
              name={child.name}
              onSelect={onSelect}
              onToggle={onToggle}
              path={child.relativePath}
              projectId={projectId}
              selectedPath={selectedPath}
              treeId={treeId}
            />
          ))}
          {directory.hasNextPage && (
            <li
              className="py-1 pr-2"
              style={{ paddingLeft: (depth + 1) * NODE_INDENT_PX + 12 }}
            >
              <Button
                isDisabled={directory.isFetchingNextPage}
                onPress={() => void directory.fetchNextPage()}
                size="sm"
                variant="ghost"
              >
                {directory.isFetchingNextPage ? <Spinner size="sm" /> : null}
                Load more folders
              </Button>
            </li>
          )}
          {!directory.isPending &&
            !directory.isError &&
            children.length === 0 && (
              <li
                className="py-1.5 italic text-muted"
                style={{ paddingLeft: (depth + 1) * NODE_INDENT_PX + 12 }}
              >
                No subfolders
              </li>
            )}
        </ul>
      )}
    </li>
  );
});
