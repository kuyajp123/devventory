import { Alert, Skeleton, Spinner } from '@heroui/react';
import { useMemo, useState } from 'react';
import { AppPagination } from '@/shared/ui/AppPagination';
import { useAssetsQuery } from '../hooks/use-assets';
import type {
  Asset,
  AssetFilters,
  AssetSortField,
  SortDirection,
} from '../models/asset';
import {
  ASSET_PAGE_SIZE,
  hasAssetFilters,
} from '../models/asset-filter-params';
import { AssetFileInspector } from './AssetFileInspector';
import {
  AssetFilters as AssetFiltersForm,
  type AssetFilterValues,
} from './AssetFilters';
import { AssetTable } from './AssetTable';

const DEFAULT_FILTERS: AssetFilters = {
  page: 1,
  pageSize: ASSET_PAGE_SIZE,
  sortBy: 'relativePath',
  sortDirection: 'ascending',
};

export function AssetBrowser({ projectId }: { projectId: string }) {
  const [filters, setFilters] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const assets = useAssetsQuery(projectId, filters);

  const filterValues = useMemo<AssetFilterValues>(
    () => ({
      category: filters.category,
      extension: filters.extension,
      favorite: filters.favorite,
      origin: filters.origin,
      search: filters.search,
      tag: filters.tag,
    }),
    [filters],
  );

  function applyFilters(values: AssetFilterValues) {
    setFilters((current) => ({ ...current, ...values, page: 1 }));
    setSelectedAsset(null);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSelectedAsset(null);
  }

  function changeSort(sortBy: AssetSortField, sortDirection: SortDirection) {
    setFilters((current) => ({
      ...current,
      page: 1,
      sortBy,
      sortDirection,
    }));
  }

  return (
    <section aria-label="Project assets" className="space-y-3">
      <AssetFiltersForm
        key={filterKey(filters)}
        onApply={applyFilters}
        onReset={resetFilters}
        values={filterValues}
      />

      {assets.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Asset files are unavailable</Alert.Title>
            <Alert.Description>
              The indexed inventory is unchanged. Confirm the project root is
              connected and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div
        className="flex min-h-[420px] rounded-md border border-divider bg-surface"
        style={{ height: 'calc(100vh - 430px)' }}
      >
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-md">
          <div className="flex min-h-9 items-center justify-between gap-3 border-b border-divider px-3 font-mono text-xs text-muted">
            <p aria-live="polite">
              {assets.data
                ? `${assets.data.totalItems.toLocaleString()} asset${assets.data.totalItems === 1 ? '' : 's'}`
                : 'Loading assets'}
            </p>
            {assets.isFetching && !assets.isPending && (
              <span className="flex items-center gap-1.5" role="status">
                <Spinner size="sm" /> Refreshing…
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {assets.isPending ? (
              <div
                aria-label="Loading project assets"
                className="space-y-2 p-3"
                role="status"
              >
                <Skeleton className="h-10 w-full rounded-sm" />
                <Skeleton className="h-52 w-full rounded-sm" />
              </div>
            ) : assets.data ? (
              <AssetTable
                assets={assets.data.items}
                hasFilters={hasAssetFilters(filters)}
                onSelectAsset={(asset) =>
                  setSelectedAsset((current) =>
                    current?.id === asset.id ? null : asset,
                  )
                }
                onSortChange={changeSort}
                selectedAssetId={selectedAsset?.id}
                sortBy={filters.sortBy}
                sortDirection={filters.sortDirection}
              />
            ) : null}
          </div>

          {assets.data && assets.data.totalPages > 1 && (
            <div className="border-t border-divider px-3 py-2">
              <AppPagination
                ariaLabel="Asset pages"
                onPageChange={(page) =>
                  setFilters((current) => ({ ...current, page }))
                }
                page={assets.data.page}
                totalPages={assets.data.totalPages}
              />
            </div>
          )}
        </div>

        {selectedAsset && (
          <AssetFileInspector
            file={selectedAsset}
            onClose={() => setSelectedAsset(null)}
          />
        )}
      </div>
    </section>
  );
}

function filterKey(filters: AssetFilters): string {
  return [
    filters.search,
    filters.category,
    filters.origin,
    filters.favorite,
    filters.extension,
    filters.tag,
  ].join('|');
}
