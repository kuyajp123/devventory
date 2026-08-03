import { Skeleton } from '@heroui/react';
import { Navigate, Outlet } from 'react-router';
import { useActiveProject } from '../providers/ActiveProjectProvider';

export function ProjectRequiredRoute() {
  const { activeProject, isHydrating } = useActiveProject();

  if (isHydrating) {
    return (
      <div
        aria-label="Loading active project"
        className="space-y-4"
        role="status"
      >
        <Skeleton className="h-12 w-2/5 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!activeProject) return <Navigate replace to="/dashboard" />;
  return <Outlet />;
}
