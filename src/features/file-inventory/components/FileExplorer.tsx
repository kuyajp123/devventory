import { Alert, Button, Spinner } from '@heroui/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AssetFileInspector } from '@/features/asset-library';
import { AppPagination } from '@/shared/ui/AppPagination';
import { useProjectDirectoryQuery } from '../hooks/use-file-inventory';
import {
  isMarkdownFile,
  type IndexedFile,
  type InventoryFilters,
  type InventoryPage,
  type InventorySortField,
  type SortDirection,
} from '../models/file-inventory';
import { getFolderBreadcrumbs } from '../models/inventory-tree';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { FolderContentsTable } from './FolderContentsTable';
import { MarkdownPreviewDrawer } from './MarkdownPreviewDrawer';
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
  const [previewMarkdownFile, setPreviewMarkdownFile] =
    useState<IndexedFile | null>(null);
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
      setPreviewMarkdownFile(null);
      onFolderChange(folderPath);
    },
    [onFolderChange],
  );

  const handleSelectFile = useCallback(
    (file: IndexedFile) => {
      setSelectedFile((current) => (current?.id === file.id ? null : file));
      if (previewMarkdownFile) {
        if (isMarkdownFile(file)) {
          setPreviewMarkdownFile(file);
        } else {
          setPreviewMarkdownFile(null);
        }
      }
    },
    [previewMarkdownFile],
  );

  const handlePreviewMarkdown = useCallback((file: IndexedFile) => {
    setPreviewMarkdownFile(file);
    setSelectedFile(file);
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
    <div className="flex min-h-0 flex-1 rounded-md border border-divider bg-surface overflow-hidden">
      <div
        className="flex shrink-0 flex-col overflow-hidden border-r border-divider bg-sidebar rounded-l-md"
        style={{ width: treeWidth }}
      >
        <div className="flex h-8 items-center border-b border-divider px-3 shrink-0">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            Explorer
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted">Live</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-divider shrink-0">
          <FolderBreadcrumb
            onNavigate={handleSelectFolder}
            segments={breadcrumbs}
          />
        </div>

        {directory.isError && (
          <Alert className="m-3 shrink-0" role="alert" status="danger">
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
          <Alert className="m-3 mb-0 shrink-0" role="status" status="warning">
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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <FolderContentsTable
            files={folderContents?.items ?? []}
            hasFilters={hasFilters}
            isFetching={isFolderFetching && !isFolderLoading}
            isLoading={isFolderLoading || directory.isPending}
            onNavigateFolder={handleSelectFolder}
            onPreviewMarkdown={handlePreviewMarkdown}
            onSelectFile={handleSelectFile}
            onSortChange={onSortChange}
            selectedFileId={previewMarkdownFile?.id ?? selectedFile?.id}
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
            subfolders={subfolders}
          />
        </div>

        {(directory.hasNextPage ||
          (folderContents && folderContents.totalPages > 1)) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-3 py-2 shrink-0">
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
      </div>

      {selectedFile && !previewMarkdownFile && (
        <AssetFileInspector
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onPreviewMarkdown={() => handlePreviewMarkdown(selectedFile)}
        />
      )}

      {previewMarkdownFile && (
        <MarkdownPreviewDrawer
          className="border-l border-divider rounded-r-md h-full"
          file={previewMarkdownFile}
          key={previewMarkdownFile.id}
          onClose={() => setPreviewMarkdownFile(null)}
          projectId={projectId}
        />
      )}
    </div>
  );
}
