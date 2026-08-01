import { Button } from '@heroui/react';
import { Component, type PropsWithChildren } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
          <section
            className="w-full max-w-lg space-y-5 rounded-2xl border border-divider bg-surface p-8 shadow-sm"
            role="alert"
          >
            <p className="text-sm font-medium text-danger">Application error</p>
            <h1 className="text-2xl font-semibold">
              Devventory could not display this screen.
            </h1>
            <p className="text-muted">
              Reload the application to return to a clean state.
            </p>
            <Button onPress={() => window.location.reload()} variant="primary">
              Reload application
            </Button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
