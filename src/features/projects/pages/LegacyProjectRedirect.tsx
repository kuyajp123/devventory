import { Skeleton } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useActiveProject } from '../hooks/use-active-project';

type LegacyDestination = 'assets' | 'asset-details' | 'dashboard' | 'files';

export function LegacyProjectRedirect({
  destination,
}: {
  destination: LegacyDestination;
}) {
  const { assetId = '', projectId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isHydrating, projects, selectProject } = useActiveProject();
  const redirected = useRef(false);

  useEffect(() => {
    if (isHydrating || redirected.current) return;
    redirected.current = true;

    if (!projects.some((project) => project.id === projectId)) {
      void navigate('/dashboard', { replace: true });
      return;
    }

    void selectProject(projectId).then(() => {
      const target = legacyTarget(destination, assetId);
      void navigate(`${target}${location.search}`, { replace: true });
    });
  }, [
    assetId,
    destination,
    isHydrating,
    location.search,
    navigate,
    projectId,
    projects,
    selectProject,
  ]);

  return (
    <div
      aria-label="Opening project module"
      className="space-y-4"
      role="status"
    >
      <Skeleton className="h-12 w-2/5 rounded-lg" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

function legacyTarget(destination: LegacyDestination, assetId: string): string {
  switch (destination) {
    case 'assets':
      return '/assets';
    case 'asset-details':
      return assetId ? `/assets/${assetId}` : '/assets';
    case 'files':
      return '/files';
    default:
      return '/dashboard';
  }
}
