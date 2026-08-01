import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { appRoutes } from './routes';

const appRouter = createBrowserRouter(appRoutes);

export function AppRouter() {
  return <RouterProvider router={appRouter} />;
}
