import { Alert, Button, Spinner } from '@heroui/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppPagination } from '@/shared/ui/AppPagination';
import { useProjectDirectoryQuery } from '../hooks/use-file-inventory';
import type {
  IndexedFile,
  InventoryFilters,
  InventoryPage,
  InventorySortField,
  SortDirection,
} from '../models/file-inventory';
import { getFolderBreadcrumbs } from '../models/inventory-tree';
import { FileDetailsPanel } from './FileDetailsPanel';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { FolderContentsTable } from './FolderContentsTable';
import { ProjectTree } from './ProjectTree';

const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 400;
const DEFAULT_TREE_WIDTH = 260;

interface FileExplorerProps {
  projectId: string;
  projectName: string;
  watchedLocations: string[];
  folderContents: InventoryPage | undefined;
  isFolderLoading: boolean;
  isFolderFetching: boolean;
  filters: InventoryFilters;
  onFolderChange: (folderPath: string) => void;
  onSortChange: (sortBy: InventorySortField, direction: SortDirection) => void;
  onPageChange: (page: number) => void;
  selectedFolder: string;
}

export function FileExplorer({
  projectId,
  projectName,
  watchedLocations,
  folderContents,
  isFolderLoading,
  isFolderFetching,
  filters,
  onFolderChange,
  onSortChange,
  onPageChange,
  selectedFolder,
}: FileExplorerProps) {
  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
  const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const directory = useProjectDirectoryQuery(projectId, selectedFolder);
  const subfolders = directory.data?.pages.flatMap((page) => page.items) ?? [];
  const entriesUnreadable =
    directory.data?.pages.reduce(
      (total, page) => total + page.entriesUnreadable,
      0,
    ) ?? 0;
  const rootIsWatched = watchedLocations.some(
    (location) => location.replace(/\\/g, '/').replace(/\/$/, '') === '.',
  );

  const breadcrumbs = useMemo(
    () => getFolderBreadcrumbs(selectedFolder, projectName),
    [selectedFolder, projectName],
  );

  const handleSelectFolder = useCallback(
    (folderPath: string) => {
      setSelectedFile(null);
      onFolderChange(folderPath);
    },
    [onFolderChange],
  );

  const handleSelectFile = useCallback((file: IndexedFile) => {
    setSelectedFile((current) => (current?.id === file.id ? null : file));
  }, []);

  const handleDividerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = treeWidth;

      function onPointerMove(pointerEvent: PointerEvent) {
        const width = Math.min(
          MAX_TREE_WIDTH,
          Math.max(MIN_TREE_WIDTH, startWidth + pointerEvent.clientX - startX),
        );
        setTreeWidth(width);
      }

      function onPointerUp() {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [treeWidth],
  );

  const hasFilters = Boolean(
    filters.category || filters.status || filters.search,
  );

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-divider bg-surface"
      style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}
    >
      <div
        className="flex shrink-0 flex-col overflow-hidden border-r border-divider bg-sidebar"
        style={{ width: treeWidth }}
      >
        <div className="flex h-8 items-center border-b border-divider px-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            Explorer
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted">Live</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <ProjectTree
            onSelectFolder={handleSelectFolder}
            projectId={projectId}
            projectName={projectName}
            rootIsWatched={rootIsWatched}
            selectedPath={selectedFolder}
          />
        </div>
      </div>

      <div
        aria-label="Resize project tree"
        className="w-1 cursor-col-resize bg-transparent transition-colors hover:bg-accent/20 active:bg-accent/40"
        onPointerDown={handleDividerPointerDown}
        ref={dividerRef}
        role="separator"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-divider">
          <FolderBreadcrumb
            onNavigate={handleSelectFolder}
            segments={breadcrumbs}
          />
        </div>

        {directory.isError && (
          <Alert className="m-3" role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>This directory could not be read</Alert.Title>
              <Alert.Description>
                The indexed files remain available. Check the directory
                permissions and retry.
              </Alert.Description>
            </Alert.Content>
            <Button
              onPress={() => void directory.refetch()}
              size="sm"
              variant="ghost"
            >
              Retry
            </Button>
          </Alert>
        )}

        {entriesUnreadable > 0 && (
          <Alert className="m-3 mb-0" role="status" status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Some folders were unavailable</Alert.Title>
              <Alert.Description>
                {entriesUnreadable.toLocaleString()} folder entr
                {entriesUnreadable === 1 ? 'y was' : 'ies were'} skipped safely.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <div className="flex-1 overflow-auto">
          <FolderContentsTable
            files={folderContents?.items ?? []}
            hasFilters={hasFilters}
            isFetching={isFolderFetching && !isFolderLoading}
            isLoading={isFolderLoading || directory.isPending}
            onNavigateFolder={handleSelectFolder}
            onSelectFile={handleSelectFile}
            onSortChange={onSortChange}
            selectedFileId={selectedFile?.id}
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            subfolders={subfolders}
          />
        </div>

        {(directory.hasNextPage ||
          (folderContents && folderContents.totalPages > 1)) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-3 py-2">
            <div>
              {directory.hasNextPage && (
                <Button
                  isDisabled={directory.isFetchingNextPage}
                  onPress={() => void directory.fetchNextPage()}
                  size="sm"
                  variant="secondary"
                >
                  {directory.isFetchingNextPage ? <Spinner size="sm" /> : null}
                  Load more folders
                </Button>
              )}
            </div>
            {folderContents && folderContents.totalPages > 1 && (
              <AppPagination
                ariaLabel="Folder contents pages"
                onPageChange={onPageChange}
                page={folderContents.page}
                totalPages={folderContents.totalPages}
              />
            )}
          </div>
        )}

        {selectedFile && (
          <FileDetailsPanel
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
          />
        )}
      </div>
    </div>
  );
}
