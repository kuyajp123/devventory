export { ProjectRequiredRoute } from './components/ProjectRequiredRoute';
export { ProjectSelector } from './components/ProjectSelector';
export { useProjectQuery } from './hooks/use-projects';
export type { Project } from './models/project';
export { DashboardPage } from './pages/DashboardPage';
export { LegacyProjectRedirect } from './pages/LegacyProjectRedirect';
export { ProjectOnboardingPage } from './pages/ProjectOnboardingPage';
export {
  ActiveProjectProvider,
  resolveInitialProjectId,
  useActiveProject,
} from './providers/ActiveProjectProvider';
