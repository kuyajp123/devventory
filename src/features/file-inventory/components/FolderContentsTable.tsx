import { Chip, EmptyState, Spinner, Table } from '@heroui/react';
import {
  IconCode,
  IconFile,
  IconFileOff,
  IconFileText,
  IconFolder,
  IconMusic,
  IconPhoto,
  IconSettings,
  IconVideo,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  formatFileSize,
  inventorySortFieldSchema,
  type FileCategory,
  type IndexedFile,
  type InventorySortField,
  type ProjectDirectoryEntry,
  type SortDirection,
} from '../models/file-inventory';

interface FolderContentsTableProps {
  /** Live direct subfolders to display. */
  subfolders: ProjectDirectoryEntry[];
  /** Files in the current folder (from paginated backend query) */
  files: IndexedFile[];
  /** Whether the file query is loading */
  isLoading: boolean;
  /** Whether files are being background-refreshed */
  isFetching: boolean;
  /** Whether any filters are active */
  hasFilters: boolean;
  /** Current sort column */
  sortBy: InventorySortField;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Callback when a sort column is clicked */
  onSortChange: (sortBy: InventorySortField, direction: SortDirection) => void;
  /** Callback when a subfolder row is clicked */
  onNavigateFolder: (folderPath: string) => void;
  /** Callback when a file row is clicked */
  onSelectFile: (file: IndexedFile) => void;
  /** Currently selected file ID */
  selectedFileId: string | undefined;
}

export function FolderContentsTable({
  subfolders,
  files,
  isLoading,
  isFetching,
  hasFilters,
  sortBy,
  sortDirection,
  onSortChange,
  onNavigateFolder,
  onSelectFile,
  selectedFileId,
}: FolderContentsTableProps) {
  const isEmpty = subfolders.length === 0 && files.length === 0 && !isLoading;

  if (isLoading) {
    return (
      <div
        className="flex min-h-48 items-center justify-center"
        role="status"
        aria-label="Loading folder contents"
      >
        <Spinner size="md" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState className="p-8 text-center">
        <IconFileOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h3 className="mt-3 text-sm font-semibold">
          {hasFilters ? 'No files match these filters' : 'This folder is empty'}
        </h3>
        <p className="mt-1 text-xs text-muted">
          {hasFilters
            ? 'Adjust the filters or reset them to see more files.'
            : 'No files or subfolders were discovered here.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute right-2 top-2 z-10">
          <Spinner aria-label="Refreshing" size="sm" />
        </div>
      )}
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Folder contents"
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
              <SortableColumn id="relativePath" isRowHeader label="Name" />
              <SortableColumn id="category" label="Category" />
              <SortableColumn id="sizeBytes" label="Size" />
              <SortableColumn id="modifiedAtMs" label="Modified" />
              <SortableColumn id="status" label="Status" />
            </Table.Header>
            <Table.Body>
              {/* Subfolder rows (not sortable — always at top) */}
              {subfolders.map((folder) => (
                <Table.Row
                  className="cursor-pointer"
                  id={`folder-${folder.relativePath}`}
                  key={folder.relativePath}
                  onAction={() => onNavigateFolder(folder.relativePath)}
                >
                  <Table.Cell className="max-w-md">
                    <div className="flex items-center gap-2">
                      <IconFolder
                        aria-hidden="true"
                        className="shrink-0 text-muted"
                        size={16}
                      />
                      <span className="truncate font-medium">
                        {folder.name}
                      </span>
                      {folder.isWatched && (
                        <span className="shrink-0 font-mono text-[10px] text-accent">
                          Watched
                        </span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-muted">Folder</Table.Cell>
                  <Table.Cell className="text-muted">—</Table.Cell>
                  <Table.Cell className="text-muted">—</Table.Cell>
                  <Table.Cell>
                    <Chip color="default" size="sm" variant="soft">
                      <Chip.Label>Available</Chip.Label>
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              ))}

              {/* File rows */}
              {files.map((file) => (
                <Table.Row
                  className={`cursor-pointer ${
                    file.id === selectedFileId ? 'bg-accent/5' : ''
                  }`}
                  id={file.id}
                  key={file.id}
                  onAction={() => onSelectFile(file)}
                >
                  <Table.Cell className="max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-muted">
                        <FileIcon category={file.category} />
                      </span>
                      <span className="truncate font-medium">{file.name}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="capitalize">
                    {file.category}
                  </Table.Cell>
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
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
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

function FileIcon({ category }: { category?: FileCategory }) {
  switch (category) {
    case 'source':
      return <IconCode aria-hidden="true" size={16} />;
    case 'image':
      return <IconPhoto aria-hidden="true" size={16} />;
    case 'document':
      return <IconFileText aria-hidden="true" size={16} />;
    case 'configuration':
      return <IconSettings aria-hidden="true" size={16} />;
    case 'audio':
      return <IconMusic aria-hidden="true" size={16} />;
    case 'video':
      return <IconVideo aria-hidden="true" size={16} />;
    default:
      return <IconFile aria-hidden="true" size={16} />;
  }
}

function formatModified(value: number | null): string {
  if (value === null) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
