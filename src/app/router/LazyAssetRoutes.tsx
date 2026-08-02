import { lazy, Suspense } from 'react';

const AssetLibraryPage = lazy(() =>
  import('@/features/asset-library').then((module) => ({
    default: module.AssetLibraryPage,
  })),
);
const AssetDetailsPage = lazy(() =>
  import('@/features/asset-library').then((module) => ({
    default: module.AssetDetailsPage,
  })),
);

export function LazyAssetLibraryPage() {
  return (
    <Suspense fallback={<div role="status">Loading asset library…</div>}>
      <AssetLibraryPage />
    </Suspense>
  );
}

export function LazyAssetDetailsPage() {
  return (
    <Suspense fallback={<div role="status">Loading asset details…</div>}>
      <AssetDetailsPage />
    </Suspense>
  );
}
