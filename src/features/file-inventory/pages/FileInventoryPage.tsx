import { Alert, Skeleton, Spinner, toast } from '@heroui/react';
import { IconFiles } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AssetBrowser, AssetImportControl } from '@/features/asset-library';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import {
  ExplorerToolbar,
  type InventoryView,
} from '../components/ExplorerToolbar';
import { FileExplorer } from '../components/FileExplorer';
import {
  InventoryFilters as InventoryFiltersForm,
  type InventoryFilterValues,
} from '../components/InventoryFilters';
import { InventoryScanBar } from '../components/InventoryScanBar';
import { InventoryTable } from '../components/InventoryTable';
import {
  useFileInventoryQuery,
  useRescanProjectMutation,
  useRescanWatchedLocationMutation,
} from '../hooks/use-file-inventory';
import {
  fileCategorySchema,
  fileStatusSchema,
  inventorySortFieldSchema,
  sortDirectionSchema,
  type FileCategory,
  type FileStatus,
  type InventoryFilters as InventoryQueryFilters,
  type InventorySortField,
  type SortDirection,
} from '../models/file-inventory';

const PAGE_SIZE = 50;

export function FileInventoryPage() {
  const {
    activeProject,
    activeProjectId: projectId,
    isHydrating,
  } = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<InventoryView>(() =>
    searchParams.get('view') === 'assets' ? 'assets' : 'explorer',
  );
  const [folderSelection, setFolderSelection] = useState({
    path: '.',
    projectId,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [explorerCategory, setExplorerCategory] = useState<
    FileCategory | undefined
  >();
  const [explorerStatus, setExplorerStatus] = useState<
    FileStatus | undefined
  >();
  const [explorerPageState, setExplorerPageState] = useState({
    page: 1,
    projectId,
  });
  const [explorerSortBy, setExplorerSortBy] =
    useState<InventorySortField>('relativePath');
  const [explorerSortDirection, setExplorerSortDirection] =
    useState<SortDirection>('ascending');
  const selectedFolder =
    folderSelection.projectId === projectId ? folderSelection.path : '.';
  const explorerPage =
    explorerPageState.projectId === projectId ? explorerPageState.page : 1;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // All Files view: read filters from URL params
  const allFilesFilters = useMemo(
    () => readFilters(searchParams),
    [searchParams],
  );

  // Explorer view: build filters from local state
  const explorerFilters = useMemo<InventoryQueryFilters>(
    () => ({
      category: explorerCategory,
      page: explorerPage,
      pageSize: PAGE_SIZE,
      parentFolder: debouncedSearch
        ? undefined
        : selectedFolder === '.'
          ? ''
          : selectedFolder,
      search: debouncedSearch || undefined,
      sortBy: explorerSortBy,
      sortDirection: explorerSortDirection,
      status: explorerStatus,
    }),
    [
      debouncedSearch,
      explorerCategory,
      explorerPage,
      explorerSortBy,
      explorerSortDirection,
      explorerStatus,
      selectedFolder,
    ],
  );

  // Use the appropriate filters based on view
  const activeFilters = view === 'explorer' ? explorerFilters : allFilesFilters;

  // Queries
  const inventory = useFileInventoryQuery(
    projectId ?? '',
    activeFilters,
    view !== 'assets',
  );
  const rescanProject = useRescanProjectMutation(projectId ?? '');
  const rescanLocation = useRescanWatchedLocationMutation(projectId ?? '');
  const isScanning = rescanProject.isPending || rescanLocation.isPending;

  // All Files view handlers
  const allFilesFilterValues: InventoryFilterValues = {
    category: allFilesFilters.category,
    extension: allFilesFilters.extension,
    search: allFilesFilters.search,
    status: allFilesFilters.status,
  };

  function applyAllFilesFilters(values: InventoryFilterValues) {
    setSearchParams(
      writeFilters({
        ...values,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: allFilesFilters.sortBy,
        sortDirection: allFilesFilters.sortDirection,
      }),
    );
  }

  function changeAllFilesPage(page: number) {
    setSearchParams(writeFilters({ ...allFilesFilters, page }));
  }

  function changeAllFilesSort(
    sortBy: InventorySortField,
    sortDirection: SortDirection,
  ) {
    setSearchParams(
      writeFilters({ ...allFilesFilters, page: 1, sortBy, sortDirection }),
    );
  }

  // Explorer view handlers
  const handleFolderChange = useCallback(
    (folderPath: string) => {
      setFolderSelection({ path: folderPath, projectId });
      setExplorerPageState({ page: 1, projectId });
    },
    [projectId],
  );

  const handleExplorerSortChange = useCallback(
    (sortBy: InventorySortField, sortDirection: SortDirection) => {
      setExplorerSortBy(sortBy);
      setExplorerSortDirection(sortDirection);
      setExplorerPageState({ page: 1, projectId });
    },
    [projectId],
  );

  const handleExplorerPageChange = useCallback(
    (page: number) => {
      setExplorerPageState({ page, projectId });
    },
    [projectId],
  );

  function changeView(nextView: InventoryView) {
    setView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    if (nextView === 'assets') nextParams.set('view', 'assets');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  }

  // Scan handlers
  const mutationError = rescanProject.error ?? rescanLocation.error;

  function scanProject() {
    toast.promise(rescanProject.mutateAsync(), {
      error: 'Project inventory scan failed',
      loading: 'Scanning project inventory…',
      success: 'Project inventory scan completed',
    });
  }

  if (isHydrating) {
    return (
      <div
        aria-label="Loading file inventory"
        className="space-y-3"
        role="status"
      >
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!activeProject || !projectId) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Project unavailable</Alert.Title>
          <Alert.Description>
            Select an available project before opening File Inventory.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const latestScan = inventory.data?.recentScans[0];

  return (
    <section className="flex w-full flex-col gap-3">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <IconFiles
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            File inventory
          </h1>
        </div>
        <p className="font-mono text-xs text-muted max-w-3xl">
          Explore and manage files and folders discovered in{' '}
          <span className="font-mono text-foreground">
            {activeProject.name}
          </span>
          .
        </p>
      </header>

      {/* Toolbar */}
      <ExplorerToolbar
        actions={
          view !== 'allFiles' ? (
            <AssetImportControl
              destination={
                view === 'explorer'
                  ? selectedFolder
                  : (activeProject.watchedLocations[0] ?? '.')
              }
              key={`${projectId}:${view}:${view === 'explorer' ? selectedFolder : (activeProject.watchedLocations[0] ?? '.')}`}
              projectId={projectId}
              watchedLocations={activeProject.watchedLocations}
            />
          ) : undefined
        }
        category={
          view === 'explorer' ? explorerCategory : allFilesFilters.category
        }
        onCategoryChange={(cat) => {
          if (view === 'explorer') {
            setExplorerCategory(cat);
            setExplorerPageState({ page: 1, projectId });
          }
        }}
        onSearchChange={(value) => {
          if (view === 'explorer') {
            setSearchInput(value);
            setExplorerPageState({ page: 1, projectId });
          }
        }}
        onStatusChange={(st) => {
          if (view === 'explorer') {
            setExplorerStatus(st);
            setExplorerPageState({ page: 1, projectId });
          }
        }}
        onViewChange={changeView}
        search={
          view === 'explorer' ? searchInput : (allFilesFilters.search ?? '')
        }
        status={view === 'explorer' ? explorerStatus : allFilesFilters.status}
        view={view}
      />

      {/* Scan Summary Bar */}
      {view !== 'assets' && (
        <InventoryScanBar
          directoriesVisited={latestScan?.directoriesVisited}
          fileCount={
            latestScan?.filesDiscovered ?? inventory.data?.totalItems ?? 0
          }
          isScanning={isScanning}
          latestScan={latestScan}
          onRescanProject={scanProject}
        />
      )}

      {/* Error states */}
      {mutationError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>The scan could not be completed</Alert.Title>
            <Alert.Description>
              Existing inventory records were preserved.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {inventory.isError && view === 'allFiles' && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>File inventory is unavailable</Alert.Title>
            <Alert.Description>
              Confirm the project root is connected and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Explorer View */}
      {view === 'explorer' && (
        <FileExplorer
          filters={explorerFilters}
          folderContents={inventory.data}
          isFolderFetching={inventory.isFetching}
          isFolderLoading={inventory.isPending}
          key={projectId}
          onFolderChange={handleFolderChange}
          onPageChange={handleExplorerPageChange}
          onSortChange={handleExplorerSortChange}
          projectId={projectId}
          projectName={activeProject.name}
          selectedFolder={selectedFolder}
          watchedLocations={activeProject.watchedLocations}
        />
      )}

      {view === 'assets' && (
        <AssetBrowser key={projectId} projectId={projectId} />
      )}

      {/* All Files View (preserved existing behavior) */}
      {view === 'allFiles' && (
        <>
          <InventoryFiltersForm
            key={`${allFilesFilters.search ?? ''}|${allFilesFilters.category ?? ''}|${allFilesFilters.extension ?? ''}|${allFilesFilters.status ?? ''}`}
            onApply={applyAllFilesFilters}
            onReset={() => setSearchParams({})}
            values={allFilesFilterValues}
          />

          {inventory.isPending && (
            <div
              aria-label="Loading file inventory"
              className="space-y-3"
              role="status"
            >
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-64 w-full rounded-md" />
            </div>
          )}

          {inventory.data && (
            <>
              <div className="flex items-center justify-between gap-4 py-1 font-mono text-xs text-muted">
                <p aria-live="polite">
                  {inventory.data.totalItems.toLocaleString()} file
                  {inventory.data.totalItems === 1 ? '' : 's'}
                </p>
                {inventory.isFetching && !inventory.isPending && (
                  <span
                    className="flex items-center gap-1.5 text-xs text-muted"
                    role="status"
                  >
                    <Spinner size="sm" /> Refreshing…
                  </span>
                )}
              </div>

              <div className="rounded-md border border-divider bg-surface overflow-hidden">
                <InventoryTable
                  files={inventory.data.items}
                  hasFilters={hasFilters(allFilesFilters)}
                  onSortChange={changeAllFilesSort}
                  sortBy={allFilesFilters.sortBy}
                  sortDirection={allFilesFilters.sortDirection}
                />
              </div>

              <AppPagination
                ariaLabel="File inventory pages"
                onPageChange={changeAllFilesPage}
                page={inventory.data.page}
                totalPages={inventory.data.totalPages}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function readFilters(searchParams: URLSearchParams): InventoryQueryFilters {
  const rawPage = Number(searchParams.get('page') ?? '1');
  const category = fileCategorySchema.safeParse(searchParams.get('category'));
  const status = fileStatusSchema.safeParse(searchParams.get('status'));
  const sortBy = inventorySortFieldSchema.safeParse(searchParams.get('sort'));
  const sortDirection = sortDirectionSchema.safeParse(
    searchParams.get('direction'),
  );
  return {
    category: category.success ? category.data : undefined,
    extension: searchParams.get('extension') || undefined,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE,
    search: searchParams.get('q') || undefined,
    sortBy: sortBy.success ? sortBy.data : 'relativePath',
    sortDirection: sortDirection.success ? sortDirection.data : 'ascending',
    status: status.success ? status.data : undefined,
  };
}

function writeFilters(filters: InventoryQueryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.extension) params.set('extension', filters.extension);
  if (filters.status) params.set('status', filters.status);
  if (filters.sortBy !== 'relativePath') params.set('sort', filters.sortBy);
  if (filters.sortDirection !== 'ascending') {
    params.set('direction', filters.sortDirection);
  }
  if (filters.page > 1) params.set('page', filters.page.toString());
  return params;
}

function hasFilters(filters: InventoryQueryFilters): boolean {
  return Boolean(
    filters.search || filters.category || filters.extension || filters.status,
  );
}
