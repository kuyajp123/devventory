import { Navigate, type RouteObject } from 'react-router';
import { AppHealthPage } from '@/features/app-health';
import { FileInventoryPage } from '@/features/file-inventory';
import {
  DashboardPage,
  LegacyProjectRedirect,
  ProjectOnboardingPage,
  ProjectRequiredRoute,
} from '@/features/projects';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LazyAssetDetailsPage, LazyAssetLibraryPage } from './LazyAssetRoutes';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, element: <Navigate replace to="/dashboard" /> },
      { path: 'dashboard', Component: DashboardPage },
      { path: 'projects/new', Component: ProjectOnboardingPage },
      {
        element: <ProjectRequiredRoute />,
        children: [
          { path: 'files', Component: FileInventoryPage },
          { path: 'assets', Component: LazyAssetLibraryPage },
          { path: 'assets/:assetId', Component: LazyAssetDetailsPage },
        ],
      },
      { path: 'diagnostics', Component: AppHealthPage },
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
