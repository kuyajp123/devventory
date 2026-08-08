import { Button, Chip } from '@heroui/react';
import { IconHistory, IconTrash, IconX } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type {
  SearchHistoryEntry,
  SearchMetadataRequest,
} from '../models/search';

interface SearchHistoryPanelProps {
  history: SearchHistoryEntry[];
  isBusy: boolean;
  onClear: () => void;
  onDelete: (historyId: string) => void;
  onRestore: (request: SearchMetadataRequest) => void;
}

export function SearchHistoryPanel({
  history,
  isBusy,
  onClear,
  onDelete,
  onRestore,
}: SearchHistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <section className="rounded-md border border-divider bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconHistory
            aria-hidden="true"
            className="text-muted"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
            Recent searches
          </h2>
        </div>
        <Button isDisabled={isBusy} onPress={onClear} size="sm" variant="ghost">
          <IconTrash
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Clear
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {history.map((entry) => (
          <li
            className="flex max-w-full items-center rounded border border-divider bg-workspace"
            key={entry.id}
          >
            <button
              aria-label={`Restore search: ${entry.request.query || 'filtered metadata'}`}
              className="flex min-h-8 min-w-0 items-center gap-2 px-2.5 text-left text-xs hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent"
              onClick={() => onRestore(entry.request)}
              type="button"
            >
              <span className="max-w-56 truncate font-mono">
                {entry.request.query || 'Filtered metadata'}
              </span>
              {filterCount(entry.request) > 0 && (
                <Chip size="sm" variant="soft">
                  <Chip.Label>{filterCount(entry.request)} filters</Chip.Label>
                </Chip>
              )}
            </button>
            <button
              aria-label={`Remove ${entry.request.query || 'filtered metadata'} from search history`}
              className="flex h-8 w-8 items-center justify-center border-l border-divider text-muted hover:text-danger focus:outline-none focus:ring-1 focus:ring-danger"
              disabled={isBusy}
              onClick={() => onDelete(entry.id)}
              type="button"
            >
              <IconX
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function filterCount(request: SearchMetadataRequest): number {
  return (
    Number(request.projectId !== null) +
    request.categories.length +
    request.extensions.length +
    request.tags.length +
    request.environmentIds.length +
    request.statuses.length +
    request.origins.length +
    Number(request.modifiedFromMs !== null) +
    Number(request.modifiedToMs !== null)
  );
}
