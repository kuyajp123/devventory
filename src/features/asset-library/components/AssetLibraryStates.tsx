import { Alert, Skeleton } from '@heroui/react';

export function AssetLibrarySkeleton() {
  return (
    <div aria-label="Loading asset library" className="space-y-3" role="status">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function AssetProjectUnavailable() {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Project unavailable</Alert.Title>
        <Alert.Description>
          The project could not be loaded from local storage.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
