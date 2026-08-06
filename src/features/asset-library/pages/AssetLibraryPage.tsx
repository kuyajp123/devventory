import { Alert, Button, Spinner, toast } from '@heroui/react';
import { IconLibrary, IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import { AssetDropZone } from '../components/AssetDropZone';
import {
  AssetFilters,
  type AssetFilterValues,
} from '../components/AssetFilters';
import { AssetImportModal } from '../components/AssetImportModal';
import {
  AssetLibrarySkeleton,
  AssetProjectUnavailable,
} from '../components/AssetLibraryStates';
import { AssetTable } from '../components/AssetTable';
import {
  useAssetsQuery,
  useSelectAssetSourceMutation,
} from '../hooks/use-assets';
import { type AssetSortField, type SortDirection } from '../models/asset';
import {
  ASSET_PAGE_SIZE,
  hasAssetFilters,
  readAssetFilters,
  writeAssetFilters,
} from '../models/asset-filter-params';

export function AssetLibraryPage() {
  const {
    activeProject,
    activeProjectId: projectId,
    isHydrating,
  } = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readAssetFilters(searchParams), [searchParams]);
  const assets = useAssetsQuery(projectId ?? '', filters);
  const picker = useSelectAssetSourceMutation();
  const [isImportOpen, setImportOpen] = useState(false);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const previousProjectId = useRef(projectId);

  useEffect(() => {
    if (previousProjectId.current === projectId) return;
    previousProjectId.current = projectId;
    setImportOpen(false);
    setSourcePath(null);
  }, [projectId]);

  const openDroppedFile = useCallback((path: string) => {
    setSourcePath(path);
    setImportOpen(true);
  }, []);

  async function chooseSource() {
    try {
      const selected = await picker.mutateAsync();
      if (selected) openDroppedFile(selected);
    } catch {
      toast.danger('The native file picker is unavailable.');
    }
  }

  function changeImportOpen(open: boolean) {
    setImportOpen(open);
    if (!open) setSourcePath(null);
  }

  function applyFilters(values: AssetFilterValues) {
    setSearchParams(
      writeAssetFilters({
        ...values,
        page: 1,
        pageSize: ASSET_PAGE_SIZE,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
      }),
    );
  }

  function changeSort(sortBy: AssetSortField, sortDirection: SortDirection) {
    setSearchParams(
      writeAssetFilters({ ...filters, page: 1, sortBy, sortDirection }),
    );
  }

  if (isHydrating) return <AssetLibrarySkeleton />;
  if (!activeProject || !projectId) return <AssetProjectUnavailable />;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <IconLibrary
              aria-hidden="true"
              className="mt-1 shrink-0 text-accent"
              size={ICON_SIZE.emptyState}
              stroke={ICON_STROKE}
            />
            <div>
              <p className="text-sm font-medium text-muted">
                {activeProject.name}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Asset library
              </h1>
              <p className="mt-2 max-w-3xl leading-7 text-muted">
                Browse discovered files and import managed assets into approved
                project locations.
              </p>
            </div>
          </div>
          <Button onPress={() => setImportOpen(true)} variant="primary">
            <IconPlus
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Import asset
          </Button>
        </div>
      </header>

      <AssetDropZone
        onChoose={() => void chooseSource()}
        onDrop={openDroppedFile}
      />

      <AssetFilters
        key={searchParams.toString()}
        onApply={applyFilters}
        onReset={() => setSearchParams({})}
        values={filters}
      />

      {assets.isPending && <AssetLibrarySkeleton />}
      {assets.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Asset library is unavailable</Alert.Title>
            <Alert.Description>
              Confirm the project root is connected and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {assets.data && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p aria-live="polite" className="text-sm text-muted">
              {assets.data.totalItems.toLocaleString()} asset
              {assets.data.totalItems === 1 ? '' : 's'}
            </p>
            {assets.isFetching && !assets.isPending && (
              <span
                className="flex items-center gap-2 text-xs text-muted"
                role="status"
              >
                <Spinner size="sm" /> Refreshing…
              </span>
            )}
          </div>
          <AssetTable
            assets={assets.data.items}
            hasFilters={hasAssetFilters(filters)}
            onSortChange={changeSort}
            sortBy={filters.sortBy}
            sortDirection={filters.sortDirection}
          />
          <AppPagination
            ariaLabel="Asset library pages"
            onPageChange={(page) =>
              setSearchParams(writeAssetFilters({ ...filters, page }))
            }
            page={assets.data.page}
            totalPages={assets.data.totalPages}
          />
        </>
      )}

      {isImportOpen && (
        <AssetImportModal
          initialSourcePath={sourcePath}
          isOpen
          onOpenChange={changeImportOpen}
          projectId={projectId}
          watchedLocations={activeProject.watchedLocations}
        />
      )}
    </section>
  );
}
