import { Navigate, type RouteObject } from 'react-router';
import { AgentUsagePage } from '@/features/agent-usage';
import { AppHealthPage } from '@/features/app-health';
import { EnvironmentTrackerPage } from '@/features/environment-tracker';
import {
  LegacyProjectRedirect,
  ProjectOnboardingPage,
  ProjectRequiredRoute,
} from '@/features/projects';
import {
  AboutUpdatesSettingsSection,
  BackgroundStartupSettingsSection,
  NotificationsSettingsSection,
  SettingsPage,
} from '@/features/settings';
import { IS_DIAGNOSTICS_ENABLED } from '@/shared/config/development.config';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LazyAssetDetailsPage } from './LazyAssetRoutes';
import { LazyDashboardRoute } from './LazyDashboardRoute';
import { LazyFileInventoryRoute } from './LazyFileInventoryRoute';
import { LazyGlobalSearchRoute } from './LazyGlobalSearchRoute';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate replace to="/dashboard" /> },
      { path: 'dashboard', Component: LazyDashboardRoute },
      { path: 'agent-usage', Component: AgentUsagePage },
      { path: 'search', Component: LazyGlobalSearchRoute },
      { path: 'projects/new', Component: ProjectOnboardingPage },
      {
        element: <ProjectRequiredRoute />,
        children: [
          { path: 'files', Component: LazyFileInventoryRoute },
          { path: 'environments/*', Component: EnvironmentTrackerPage },
          {
            path: 'validation',
            element: <Navigate replace to="/environments/rules" />,
          },
          {
            path: 'assets',
            element: <Navigate replace to="/files?view=assets" />,
          },
          { path: 'assets/:assetId', Component: LazyAssetDetailsPage },
        ],
      },
      {
        path: 'settings',
        Component: SettingsPage,
        children: [
          { index: true, element: <Navigate replace to="notifications" /> },
          { path: 'notifications', Component: NotificationsSettingsSection },
          {
            path: 'background-startup',
            Component: BackgroundStartupSettingsSection,
          },
          {
            path: 'about-updates',
            Component: AboutUpdatesSettingsSection,
          },
        ],
      },
      ...(IS_DIAGNOSTICS_ENABLED
        ? [{ path: 'diagnostics', Component: AppHealthPage }]
        : []),
      {
        path: 'projects',
        element: <Navigate replace to="/dashboard" />,
      },
      {
        path: 'projects/:projectId',
        element: <LegacyProjectRedirect destination="dashboard" />,
      },
      {
        path: 'projects/:projectId/files',
        element: <LegacyProjectRedirect destination="files" />,
      },
      {
        path: 'projects/:projectId/assets',
        element: <LegacyProjectRedirect destination="assets" />,
      },
      {
        path: 'projects/:projectId/assets/:assetId',
        element: <LegacyProjectRedirect destination="asset-details" />,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
