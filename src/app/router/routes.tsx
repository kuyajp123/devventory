import type { RouteObject } from 'react-router';
import { AppHealthPage } from '@/features/app-health';
import { ProjectFileInventoryPage } from '@/features/file-inventory';
import {
  ProjectDetailsPage,
  ProjectOnboardingPage,
  ProjectsPage,
} from '@/features/projects';
import { AppLayout } from '../layouts/AppLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LazyAssetDetailsPage, LazyAssetLibraryPage } from './LazyAssetRoutes';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'projects', Component: ProjectsPage },
      { path: 'projects/new', Component: ProjectOnboardingPage },
      { path: 'projects/:projectId', Component: ProjectDetailsPage },
      {
        path: 'projects/:projectId/files',
        Component: ProjectFileInventoryPage,
      },
      {
        path: 'projects/:projectId/assets',
        Component: LazyAssetLibraryPage,
      },
      {
        path: 'projects/:projectId/assets/:assetId',
        Component: LazyAssetDetailsPage,
      },
      { path: 'diagnostics', Component: AppHealthPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
