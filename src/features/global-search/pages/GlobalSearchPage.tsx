import { Alert, Skeleton, toast } from '@heroui/react';
import { IconDatabaseSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useEnvironmentsQuery } from '@/features/environment-tracker';
import { useActiveProject } from '@/features/projects';
import { ICON_STROKE } from '@/shared/constants/icon.constants';
import { SearchFilters } from '../components/SearchFilters';
import { SearchHistoryPanel } from '../components/SearchHistoryPanel';
import { SearchResultInspector } from '../components/SearchResultInspector';
import { SearchResultsTable } from '../components/SearchResultsTable';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import {
  useClearSearchHistoryMutation,
  useDeleteSearchHistoryMutation,
  useRecordSearchHistoryMutation,
  useSearchHistoryQuery,
  useSearchQuery,
} from '../hooks/use-search';
import {
  DEFAULT_SEARCH_REQUEST,
  type SearchMetadataRequest,
  type SearchResult,
} from '../models/search';

const SEARCH_DEBOUNCE_MS = 300;

function getResultId(res: SearchResult): string {
  return res.resultType === 'environment_key'
    ? `${res.resultType}:${res.id}:${res.environmentId}`
    : `${res.resultType}:${res.id}`;
}

export function GlobalSearchPage() {
  const { activeProjectId, projects, selectProject } = useActiveProject();
  const [searchParams] = useSearchParams();
  const initialRequest = useMemo<SearchMetadataRequest>(
    () => ({
      ...DEFAULT_SEARCH_REQUEST,
      projectId:
        searchParams.get('scope') === 'all' ? null : (activeProjectId ?? null),
      query: searchParams.get('q')?.slice(0, 256) ?? '',
    }),
    // The route initializes its scope once. Later project changes are explicit filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [request, setRequest] = useState(initialRequest);
  const [queryText, setQueryText] = useState(initialRequest.query);
  const [filterRevision, setFilterRevision] = useState(0);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  );
  const debouncedQuery = useDebouncedValue(queryText, SEARCH_DEBOUNCE_MS);
  const effectiveRequest = useMemo(
    () => ({
      ...request,
      query:
        request.query === queryText
          ? request.query.trim()
          : debouncedQuery.trim(),
    }),
    [debouncedQuery, queryText, request],
  );

  const search = useSearchQuery(effectiveRequest);
  const history = useSearchHistoryQuery();
  const recordHistory = useRecordSearchHistoryMutation();
  const deleteHistory = useDeleteSearchHistoryMutation();
  const clearHistory = useClearSearchHistoryMutation();
  const environments = useEnvironmentsQuery(request.projectId ?? '');
  const navigate = useNavigate();

  // Derive active selected result so stale result state is automatically ignored if no longer present
  const activeSelectedResult = useMemo(() => {
    if (!selectedResult) return null;
    if (!search.data?.items) return selectedResult;
    const exists = search.data.items.some(
      (item) => getResultId(item) === getResultId(selectedResult),
    );
    return exists ? selectedResult : null;
  }, [search.data?.items, selectedResult]);

  // Handle Escape key to close details inspector
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && activeSelectedResult !== null) {
        setSelectedResult(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelectedResult]);

  function apply(next: SearchMetadataRequest, shouldRecord: boolean) {
    setSelectedResult(null);
    setQueryText(next.query);
    setRequest(next);
    if (shouldRecord) {
      void recordHistory.mutateAsync(next).catch(() => {
        toast.warning(
          'The search ran, but its history entry could not be saved.',
        );
      });
    }
  }

  function restore(next: SearchMetadataRequest) {
    setSelectedResult(null);
    const restored = { ...next, page: 1 };
    setFilterRevision((revision) => revision + 1);
    apply(restored, true);
  }

  function updateRequest(nextRequest: SearchMetadataRequest) {
    setSelectedResult(null);
    setRequest(nextRequest);
  }

  const openResult = useCallback(
    async (result: SearchResult) => {
      try {
        await selectProject(result.projectId);
        if (result.resultType === 'project') {
          await navigate('/dashboard');
        } else if (result.resultType === 'environment_key') {
          await navigate(
            `/environments?search=${encodeURIComponent(result.name)}`,
          );
        } else if (result.origin === 'managed') {
          await navigate(`/assets/${result.id}`);
        } else {
          await navigate(`/files?q=${encodeURIComponent(result.relativePath)}`);
        }
      } catch {
        toast.danger('That search result is no longer available.');
      }
    },
    [navigate, selectProject],
  );

  return (
    <section className="flex flex-1 flex-col min-h-0 min-w-0 gap-3 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-divider pb-2.5">
        <div className="flex items-center gap-2">
          <IconDatabaseSearch
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={22}
            stroke={ICON_STROKE}
          />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Global search
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Search Devventory-owned metadata only. File contents, environment
          values, credentials, and Agent Usage identifiers are never searched.
        </p>
      </header>

      {/* Primary Search Controls & Collapsible Advanced Filters */}
      <SearchFilters
        environments={environments.data ?? []}
        key={filterRevision}
        onApply={apply}
        onProjectScopeChange={(projectId) => {
          setSelectedResult(null);
          setRequest((current) => ({
            ...current,
            environmentIds: [],
            page: 1,
            projectId,
          }));
        }}
        onQueryChange={(query) => {
          setSelectedResult(null);
          setQueryText(query);
          setRequest((current) => ({ ...current, page: 1 }));
        }}
        projects={projects}
        request={request}
      />

      {/* Search History Panel */}
      {history.data && (
        <div className="shrink-0">
          <SearchHistoryPanel
            history={history.data}
            isBusy={deleteHistory.isPending || clearHistory.isPending}
            onClear={() => {
              void clearHistory.mutateAsync().catch(() => {
                toast.danger('Search history could not be cleared.');
              });
            }}
            onDelete={(historyId) => {
              void deleteHistory.mutateAsync(historyId).catch(() => {
                toast.danger('That search history entry could not be removed.');
              });
            }}
            onRestore={restore}
          />
        </div>
      )}

      {/* Searching Skeleton */}
      {search.isPending && (
        <div
          aria-label="Searching metadata"
          className="flex flex-1 min-h-0 flex-col space-y-3"
          role="status"
        >
          <Skeleton className="h-10 w-full rounded-[4px]" />
          <Skeleton className="flex-1 w-full rounded-[4px]" />
        </div>
      )}

      {/* Error Alert */}
      {search.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Search is unavailable</Alert.Title>
            <Alert.Description>
              Devventory could not query the local metadata database. Existing
              project data was not changed.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* Main Results Workspace: Results Table + Side-by-Side File Inspector */}
      {search.data && (
        <div className="flex flex-1 flex-row min-h-0 min-w-0 gap-3 overflow-hidden">
          <SearchResultsTable
            isFetching={search.isFetching}
            items={search.data.items}
            onOpenResult={(result) => void openResult(result)}
            onRequestChange={updateRequest}
            onSelectResult={(result) =>
              setSelectedResult((current) =>
                current && getResultId(current) === getResultId(result)
                  ? null
                  : result,
              )
            }
            request={effectiveRequest}
            selectedResultId={
              activeSelectedResult ? getResultId(activeSelectedResult) : null
            }
            totalItems={search.data.totalItems}
            totalPages={search.data.totalPages}
          />

          {activeSelectedResult && (
            <SearchResultInspector
              onClose={() => setSelectedResult(null)}
              onOpenResult={(result) => void openResult(result)}
              result={activeSelectedResult}
            />
          )}
        </div>
      )}
    </section>
  );
}
