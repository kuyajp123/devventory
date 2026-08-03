import { toast } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useProjectsQuery } from '../hooks/use-projects';
import type { Project } from '../models/project';
import { projectSelectionGateway } from '../services/project-selection.gateway';

const projectSelectionKeys = {
  lastOpened: ['project-selection', 'last-opened'] as const,
};

interface ActiveProjectContextValue {
  activeProject: Project | null;
  activeProjectId: string | null;
  hasProjects: boolean;
  isHydrating: boolean;
  projectLoadFailed: boolean;
  projects: Project[];
  selectProject: (projectId: string) => Promise<void>;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(
  null,
);

export function resolveInitialProjectId(
  projects: Project[],
  storedProjectId: string | null,
): string | null {
  if (
    storedProjectId &&
    projects.some((project) => project.id === storedProjectId)
  ) {
    return storedProjectId;
  }

  return projects[0]?.id ?? null;
}

export function ActiveProjectProvider({ children }: PropsWithChildren) {
  const projectsQuery = useProjectsQuery();
  const storedSelection = useQuery({
    queryFn: projectSelectionGateway.getLastOpenedProjectId,
    queryKey: projectSelectionKeys.lastOpened,
    retry: false,
  });
  const [activeProjectId, setActiveProjectId] = useState<
    string | null | undefined
  >(undefined);
  const initialized = useRef(false);
  const warnedAboutRead = useRef(false);

  const projects = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );

  const persistSelection = useCallback(async (projectId: string) => {
    try {
      await projectSelectionGateway.saveLastOpenedProjectId(projectId);
    } catch {
      toast.warning(
        'The project changed, but Devventory could not remember it for the next launch.',
      );
    }
  }, []);

  useEffect(() => {
    if (
      initialized.current ||
      projectsQuery.isPending ||
      storedSelection.isPending
    ) {
      return;
    }

    initialized.current = true;
    const resolved = resolveInitialProjectId(
      projects,
      storedSelection.data ?? null,
    );
    setActiveProjectId(resolved);

    if (resolved && resolved !== storedSelection.data) {
      void persistSelection(resolved);
    }
  }, [
    persistSelection,
    projects,
    projectsQuery.isPending,
    storedSelection.data,
    storedSelection.isPending,
  ]);

  useEffect(() => {
    if (!storedSelection.isError || warnedAboutRead.current) return;
    warnedAboutRead.current = true;
    toast.warning(
      'Devventory could not restore the last opened project. The most recent project was selected instead.',
    );
  }, [storedSelection.isError]);

  useEffect(() => {
    if (!initialized.current || activeProjectId === undefined) return;
    if (
      activeProjectId === null ||
      projects.some((project) => project.id === activeProjectId)
    ) {
      if (activeProjectId === null && projects[0]) {
        setActiveProjectId(projects[0].id);
        void persistSelection(projects[0].id);
      }
      return;
    }

    const fallback = projects[0]?.id ?? null;
    setActiveProjectId(fallback);
    if (fallback) void persistSelection(fallback);
  }, [activeProjectId, persistSelection, projects]);

  const selectProject = useCallback(
    async (projectId: string) => {
      setActiveProjectId(projectId);
      await persistSelection(projectId);
    },
    [persistSelection],
  );

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? null;
  const isHydrating =
    projectsQuery.isPending ||
    storedSelection.isPending ||
    activeProjectId === undefined;

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      activeProject,
      activeProjectId: activeProjectId ?? null,
      hasProjects: projects.length > 0,
      isHydrating,
      projectLoadFailed: projectsQuery.isError,
      projects,
      selectProject,
    }),
    [
      activeProject,
      activeProjectId,
      isHydrating,
      projects,
      projectsQuery.isError,
      selectProject,
    ],
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject(): ActiveProjectContextValue {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error('useActiveProject must be used inside ActiveProjectProvider.');
  }
  return context;
}
