import { lazy, Suspense } from 'react';

const FileInventoryPage = lazy(() =>
  import('@/features/file-inventory').then((module) => ({
    default: module.FileInventoryPage,
  })),
);

export function LazyFileInventoryRoute() {
  return (
    <Suspense
      fallback={
        <div className="p-6 font-mono text-xs text-muted" role="status">
          Loading file inventory…
        </div>
      }
    >
      <FileInventoryPage />
    </Suspense>
  );
}
