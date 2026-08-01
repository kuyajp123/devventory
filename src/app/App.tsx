import { AppErrorBoundary } from './errors/AppErrorBoundary';
import { AppRouter } from './router/AppRouter';

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}
