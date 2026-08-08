import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() =>
  import('@/features/dashboard').then((module) => ({
    default: module.DashboardPage,
  })),
);

export function LazyDashboardRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-6 font-mono text-xs text-muted" role="status">
          Loading project dashboard…
        </div>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}
