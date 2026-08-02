import { Chip, EmptyState, Table } from '@heroui/react';
import { IconFileOff } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  formatFileSize,
  inventorySortFieldSchema,
  type IndexedFile,
  type InventorySortField,
  type SortDirection,
} from '../models/file-inventory';

interface InventoryTableProps {
  files: IndexedFile[];
  hasFilters: boolean;
  onSortChange: (
    sortBy: InventorySortField,
    sortDirection: SortDirection,
  ) => void;
  sortBy: InventorySortField;
  sortDirection: SortDirection;
}

export function InventoryTable({
  files,
  hasFilters,
  onSortChange,
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
    <Table variant="secondary">
      <Table.ScrollContainer>
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
          <Table.Header>
            <SortableColumn id="relativePath" isRowHeader label="File" />
            <SortableColumn id="category" label="Category" />
            <SortableColumn id="sizeBytes" label="Size" />
            <SortableColumn id="modifiedAtMs" label="Modified" />
            <SortableColumn id="status" label="Status" />
          </Table.Header>
          <Table.Body items={files}>
            {(file) => (
              <Table.Row id={file.id}>
                <Table.Cell className="max-w-md">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {file.relativePath}
                  </p>
                </Table.Cell>
                <Table.Cell className="capitalize">{file.category}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  {formatFileSize(file.sizeBytes)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-muted">
                  {formatModified(file.modifiedAtMs)}
                </Table.Cell>
                <Table.Cell>
                  <StatusChip status={file.status} />
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

function StatusChip({ status }: { status: IndexedFile['status'] }) {
  return (
    <Chip
      color={status === 'active' ? 'success' : 'warning'}
      size="sm"
      variant="soft"
    >
      <Chip.Label>{status === 'active' ? 'Active' : 'Missing'}</Chip.Label>
    </Chip>
  );
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
