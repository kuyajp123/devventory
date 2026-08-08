import { lazy, Suspense } from 'react';

const GlobalSearchPage = lazy(() =>
  import('@/features/global-search').then((module) => ({
    default: module.GlobalSearchPage,
  })),
);

export function LazyGlobalSearchRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-6 font-mono text-xs text-muted" role="status">
          Loading metadata search…
        </div>
      }
    >
      <GlobalSearchPage />
    </Suspense>
  );
}
