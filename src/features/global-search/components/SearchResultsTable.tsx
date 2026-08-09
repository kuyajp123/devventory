import { Button, Chip, EmptyState, Spinner, Table } from '@heroui/react';
import {
  type ColumnDef,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  IconArrowDown,
  IconArrowUp,
  IconExternalLink,
  IconSearchOff,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import { SemanticStatusChip } from '@/shared/ui';
import {
  resultContext,
  type SearchMetadataRequest,
  type SearchResult,
  type SearchSortField,
} from '../models/search';

interface SearchResultsTableProps {
  isFetching: boolean;
  items: SearchResult[];
  onOpenResult: (result: SearchResult) => void;
  onRequestChange: (request: SearchMetadataRequest) => void;
  request: SearchMetadataRequest;
  totalItems: number;
  totalPages: number;
}

const searchTableFeatures = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
});

export function SearchResultsTable({
  isFetching,
  items,
  onOpenResult,
  onRequestChange,
  request,
  totalItems,
  totalPages,
}: SearchResultsTableProps) {
  const columns = useMemo<
    ColumnDef<typeof searchTableFeatures, SearchResult>[]
  >(
    () => [
      {
        accessorFn: (result) => result.name,
        cell: ({ row }) => (
          <div className="min-w-52 max-w-md">
            <p className="truncate font-medium text-foreground">
              {row.original.name}
            </p>
            <p className="truncate font-mono text-xs text-muted">
              {resultContext(row.original)}
            </p>
          </div>
        ),
        header: 'Name',
        id: 'name',
      },
      {
        cell: ({ row }) => <ResultTypeChip result={row.original} />,
        enableSorting: false,
        header: 'Type',
        id: 'type',
      },
      {
        accessorFn: (result) => result.projectName,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {row.original.projectName}
          </span>
        ),
        header: 'Project',
        id: 'project',
      },
      {
        cell: ({ row }) => <ResultMetadata result={row.original} />,
        enableSorting: false,
        header: 'Metadata',
        id: 'metadata',
      },
      {
        accessorFn: (result) =>
          result.resultType === 'file' ? result.modifiedAtMs : null,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted">
            {row.original.resultType === 'file'
              ? formatModified(row.original.modifiedAtMs)
              : '—'}
          </span>
        ),
        header: 'Modified',
        id: 'modified',
      },
      {
        cell: ({ row }) => (
          <Button
            aria-label={`Open ${row.original.name}`}
            isIconOnly
            onPress={() => onOpenResult(row.original)}
            size="sm"
            variant="ghost"
          >
            <IconExternalLink
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          </Button>
        ),
        enableSorting: false,
        header: 'Open',
        id: 'actions',
      },
    ],
    [onOpenResult],
  );
  const sorting = useMemo<SortingState>(
    () =>
      request.sortBy === 'relevance'
        ? []
        : [
            {
              desc: request.sortDirection === 'descending',
              id: request.sortBy,
            },
          ],
    [request.sortBy, request.sortDirection],
  );
  const table = useTable({
    features: searchTableFeatures,
    columns,
    data: items,
    getRowId: (result) =>
      result.resultType === 'environment_key'
        ? `${result.resultType}:${result.id}:${result.environmentId}`
        : `${result.resultType}:${result.id}`,
    manualPagination: true,
    manualSorting: true,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const selected = next[0];
      if (!selected) {
        onRequestChange({
          ...request,
          page: 1,
          sortBy: 'relevance',
          sortDirection: 'ascending',
        });
        return;
      }
      onRequestChange({
        ...request,
        page: 1,
        sortBy: selected.id as SearchSortField,
        sortDirection: selected.desc ? 'descending' : 'ascending',
      });
    },
    rowCount: totalItems,
    state: {
      pagination: {
        pageIndex: request.page - 1,
        pageSize: request.pageSize,
      },
      sorting,
    },
  });

  if (items.length === 0) {
    if (isFetching) {
      return (
        <div
          aria-label="Searching metadata"
          className="flex min-h-56 items-center justify-center rounded-md border border-divider bg-surface"
          role="status"
        >
          <Spinner size="lg" />
        </div>
      );
    }
    return (
      <EmptyState className="rounded-md border border-dashed border-divider bg-surface p-10 text-center">
        <IconSearchOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-3 text-base font-semibold">No metadata matched</h2>
        <p className="mt-1 text-xs text-muted">
          Try a broader query or remove one of the advanced filters.
        </p>
      </EmptyState>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-divider bg-surface">
      <div className="flex items-center justify-between border-b border-divider px-4 py-2 font-mono text-xs text-muted">
        <span>{totalItems.toLocaleString()} matching results</span>
        {isFetching && (
          <Spinner aria-label="Refreshing search results" size="sm" />
        )}
      </div>
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Global metadata search results">
            <Table.Header>
              {table.getFlatHeaders().map((header, index) => (
                <Table.Column
                  id={header.id}
                  isRowHeader={index === 0}
                  key={header.id}
                >
                  {header.column.getCanSort() ? (
                    <Button
                      aria-label={`Sort by ${String(header.column.columnDef.header).toLowerCase()}`}
                      className="h-auto min-w-0 gap-1 px-0 font-inherit text-inherit"
                      onPress={() => header.column.toggleSorting()}
                      size="sm"
                      variant="ghost"
                    >
                      <table.FlexRender header={header} />
                      {header.column.getIsSorted() === 'asc' ? (
                        <IconArrowUp aria-hidden="true" size={12} />
                      ) : header.column.getIsSorted() === 'desc' ? (
                        <IconArrowDown aria-hidden="true" size={12} />
                      ) : null}
                    </Button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body items={table.getRowModel().rows}>
              {(row) => (
                <Table.Row id={row.id}>
                  {row.getAllCells().map((cell) => (
                    <Table.Cell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </Table.Cell>
                  ))}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <div className="border-t border-divider p-3">
        <AppPagination
          ariaLabel="Global search pages"
          onPageChange={(page) => onRequestChange({ ...request, page })}
          page={request.page}
          totalPages={totalPages}
        />
      </div>
    </section>
  );
}

function ResultTypeChip({ result }: { result: SearchResult }) {
  const label =
    result.resultType === 'environment_key'
      ? 'Environment key'
      : result.resultType === 'file' && result.origin === 'managed'
        ? 'Managed asset'
        : result.resultType;
  return (
    <Chip size="sm" variant="soft">
      <Chip.Label className="capitalize">{label}</Chip.Label>
    </Chip>
  );
}

function ResultMetadata({ result }: { result: SearchResult }) {
  if (result.resultType !== 'file') {
    return <span className="text-xs text-muted">—</span>;
  }
  return (
    <div className="flex max-w-xs flex-wrap gap-1">
      <Chip size="sm" variant="soft">
        <Chip.Label className="capitalize">{result.category}</Chip.Label>
      </Chip>
      <SemanticStatusChip
        dataStatus={result.status}
        label={result.status}
        labelClassName="capitalize"
        tone={result.status === 'active' ? 'success' : 'warning'}
      />
      {result.tags.slice(0, 2).map((tag) => (
        <Chip key={tag} size="sm" variant="soft">
          <Chip.Label>{tag}</Chip.Label>
        </Chip>
      ))}
    </div>
  );
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
