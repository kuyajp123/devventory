import { Alert, Skeleton, toast } from '@heroui/react';
import { IconDatabaseSearch } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useEnvironmentsQuery } from '@/features/environment-tracker';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SearchFilters } from '../components/SearchFilters';
import { SearchHistoryPanel } from '../components/SearchHistoryPanel';
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

  function apply(next: SearchMetadataRequest, shouldRecord: boolean) {
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
    const restored = { ...next, page: 1 };
    setFilterRevision((revision) => revision + 1);
    apply(restored, true);
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
    <section className="mx-auto w-full max-w-7xl space-y-4">
      <header className="border-b border-divider pb-3">
        <div className="flex items-center gap-2">
          <IconDatabaseSearch
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Global search
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">
          Search Devventory-owned metadata only. File contents, environment
          values, credentials, and Agent Usage identifiers are never searched.
        </p>
      </header>

      <SearchFilters
        environments={environments.data ?? []}
        key={filterRevision}
        onApply={apply}
        onQueryChange={(query) => {
          setQueryText(query);
          setRequest((current) => ({ ...current, page: 1 }));
        }}
        onProjectScopeChange={(projectId) => {
          setRequest((current) => ({
            ...current,
            environmentIds: [],
            page: 1,
            projectId,
          }));
        }}
        projects={projects}
        request={request}
      />

      {history.data && (
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
      )}

      {search.isPending && (
        <div
          aria-label="Searching metadata"
          className="space-y-3"
          role="status"
        >
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-72 w-full rounded-md" />
        </div>
      )}

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

      {search.data && (
        <SearchResultsTable
          isFetching={search.isFetching}
          items={search.data.items}
          onOpenResult={(result) => void openResult(result)}
          onRequestChange={setRequest}
          request={effectiveRequest}
          totalItems={search.data.totalItems}
          totalPages={search.data.totalPages}
        />
      )}
    </section>
  );
}
