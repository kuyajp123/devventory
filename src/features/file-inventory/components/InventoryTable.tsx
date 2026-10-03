import { Button, EmptyState, Table, Tooltip } from '@heroui/react';
import { IconEye, IconFileOff } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  formatFileSize,
  inventorySortFieldSchema,
  type IndexedFile,
  type InventorySortField,
  type SortDirection,
} from '../models/file-inventory';
import { InventoryStatusChip } from './InventoryStatusChip';

interface InventoryTableProps {
  files: IndexedFile[];
  hasFilters: boolean;
  onPreviewMarkdown?: (file: IndexedFile) => void;
  onSelectFile?: (file: IndexedFile) => void;
  onSortChange: (
    sortBy: InventorySortField,
    sortDirection: SortDirection,
  ) => void;
  selectedFileId?: string;
  sortBy: InventorySortField;
  sortDirection: SortDirection;
}

export function InventoryTable({
  files,
  hasFilters,
  onPreviewMarkdown,
  onSelectFile,
  onSortChange,
  selectedFileId,
  sortBy,
  sortDirection,
}: InventoryTableProps) {
  if (files.length === 0) {
    return (
      <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-8 text-center">
        <IconFileOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-4 text-lg font-semibold">
          {hasFilters ? 'No files match these filters' : 'No indexed files yet'}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {hasFilters
            ? 'Adjust the filters or reset them to see more files.'
            : 'Run a project scan to build the local metadata inventory.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <Table className="flex flex-1 flex-col min-h-0 min-w-0" variant="secondary">
      <Table.ScrollContainer className="flex-1 min-h-0 min-w-0 overflow-auto">
        <Table.Content
          aria-label="Indexed files"
          onSortChange={(descriptor) => {
            const nextSort = inventorySortFieldSchema.safeParse(
              descriptor.column,
            );
            if (nextSort.success) {
              onSortChange(nextSort.data, descriptor.direction);
            }
          }}
          sortDescriptor={{ column: sortBy, direction: sortDirection }}
        >
          <Table.Header className="sticky top-0 z-10 bg-surface">
            <SortableColumn id="relativePath" isRowHeader label="File" />
            <SortableColumn id="category" label="Category" />
            <SortableColumn id="sizeBytes" label="Size" />
            <SortableColumn id="modifiedAtMs" label="Modified" />
            <SortableColumn id="status" label="Status" />
          </Table.Header>
          <Table.Body items={files}>
            {(file) => (
              <Table.Row
                className={`cursor-pointer ${
                  file.id === selectedFileId ? 'bg-accent/5' : ''
                }`}
                id={file.id}
                onAction={() => onSelectFile?.(file)}
              >
                <Table.Cell className="max-w-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="truncate font-mono text-xs text-muted">
                        {file.relativePath}
                      </p>
                    </div>
                    {onPreviewMarkdown &&
                      (file.extension?.toLowerCase() === 'md' ||
                        file.name.toLowerCase().endsWith('.md')) && (
                        <Tooltip delay={0}>
                          <Button
                            aria-label={`Preview markdown for ${file.name}`}
                            className="shrink-0 text-muted hover:text-accent"
                            isIconOnly
                            onPress={() => onPreviewMarkdown(file)}
                            size="sm"
                            variant="ghost"
                          >
                            <IconEye
                              aria-hidden="true"
                              size={ICON_SIZE.button}
                              stroke={ICON_STROKE}
                            />
                          </Button>
                          <Tooltip.Content placement="top">
                            <p>Preview Markdown</p>
                          </Tooltip.Content>
                        </Tooltip>
                      )}
                  </div>
                </Table.Cell>
                <Table.Cell className="capitalize">{file.category}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formatFileSize(file.sizeBytes)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-muted">
                  {formatModified(file.modifiedAtMs)}
                </Table.Cell>
                <Table.Cell>
                  <InventoryStatusChip status={file.status} />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function SortableColumn({
  id,
  isRowHeader,
  label,
}: {
  id: InventorySortField;
  isRowHeader?: boolean;
  label: string;
}) {
  return (
    <Table.Column allowsSorting id={id} isRowHeader={isRowHeader}>
      {({ sortDirection }) => (
        <Table.SortableColumnHeader sortDirection={sortDirection}>
          {label}
        </Table.SortableColumnHeader>
      )}
    </Table.Column>
  );
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
