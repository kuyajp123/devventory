import { Button, Chip, toast, Tooltip } from '@heroui/react';
import {
  IconCopy,
  IconExternalLink,
  IconFile,
  IconFolder,
  IconKey,
  IconX,
} from '@tabler/icons-react';
import { useCallback } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import { resultContext, type SearchResult } from '../models/search';

interface SearchResultInspectorProps {
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
  result: SearchResult;
}

export function SearchResultInspector({
  onClose,
  onOpenResult,
  result,
}: SearchResultInspectorProps) {
  const fullPath = resultContext(result);

  const copyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPath);
      toast.success('Path copied to clipboard');
    } catch {
      toast.danger('Could not copy path');
    }
  }, [fullPath]);

  const Icon =
    result.resultType === 'environment_key'
      ? IconKey
      : result.resultType === 'project'
        ? IconFolder
        : IconFile;

  return (
    <aside
      aria-label="File details inspector"
      className="flex w-80 shrink-0 flex-col min-h-0 border border-divider bg-surface rounded-[4px] overflow-hidden"
    >
      {/* Inspector Header */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-divider px-3.5 bg-surface">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
          File details
        </h2>
        <Tooltip delay={0}>
          <Button
            aria-label="Close details inspector"
            isIconOnly
            onPress={onClose}
            size="sm"
            variant="ghost"
          >
            <IconX
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
          <Tooltip.Content>
            <p>Close inspector (Esc)</p>
          </Tooltip.Content>
        </Tooltip>
      </header>

      {/* Inspector Body - Independent vertical scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
        {/* Identity & Icon */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-subtle/50 text-accent">
            <Icon
              aria-hidden="true"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-semibold text-sm text-foreground">
              {result.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted capitalize">
              {result.resultType.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            onPress={() => onOpenResult(result)}
            size="sm"
            variant="primary"
          >
            <IconExternalLink
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            Open
          </Button>
          <Button
            className="flex-1"
            onPress={() => void copyPath()}
            size="sm"
            variant="secondary"
          >
            <IconCopy
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            Copy path
          </Button>
        </div>

        {/* Full Path */}
        <div className="space-y-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
            Location path
          </span>
          <div className="break-all font-mono text-xs text-secondary bg-workspace p-2 rounded border border-divider select-text">
            {fullPath}
          </div>
        </div>

        {/* Metadata Properties Grid */}
        <div className="space-y-2.5 border-t border-divider pt-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
            Properties
          </span>

          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Project</dt>
              <dd className="mt-0.5 font-medium text-foreground truncate">
                {result.projectName}
              </dd>
            </div>
            {result.resultType === 'file' && (
              <>
                <div>
                  <dt className="text-muted">Origin</dt>
                  <dd className="mt-0.5 font-medium text-foreground capitalize">
                    {result.origin}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Category</dt>
                  <dd className="mt-0.5 font-medium text-foreground capitalize">
                    {result.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Status</dt>
                  <dd className="mt-0.5">
                    <SemanticStatusChip
                      dataStatus={result.status}
                      label={result.status}
                      labelClassName="capitalize text-[10px]"
                      tone={result.status === 'active' ? 'success' : 'warning'}
                    />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">Modified date</dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {formatTimestamp(result.modifiedAtMs)}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Tags */}
        {result.resultType === 'file' && result.tags.length > 0 && (
          <div className="space-y-1.5 border-t border-divider pt-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
              Asset tags
            </span>
            <div className="flex flex-wrap gap-1">
              {result.tags.map((tag) => (
                <Chip key={tag} size="sm" variant="soft">
                  <Chip.Label>{tag}</Chip.Label>
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function formatTimestamp(value: number | null): string {
  if (value === null) return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
}
