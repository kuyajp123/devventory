import { createContext } from 'react';
import type { Project } from '../models/project';

export interface ActiveProjectContextValue {
  activeProject: Project | null;
  activeProjectId: string | null;
  hasProjects: boolean;
  isHydrating: boolean;
  projectLoadFailed: boolean;
  projects: Project[];
  selectProject: (projectId: string) => Promise<void>;
}

export const ActiveProjectContext =
  createContext<ActiveProjectContextValue | null>(null);
