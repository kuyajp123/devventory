import { Alert, Button, Card } from '@heroui/react';
import { Component, type PropsWithChildren } from 'react';
import appIcon from '@/assets/devventory-app-icon.png';

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
          <Card className="w-full max-w-lg">
            <Card.Content className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={appIcon}
                  alt="Devventory"
                  className="h-8 w-8 rounded"
                />
                <span className="font-mono text-sm font-bold">Devventory</span>
              </div>
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Application error</Alert.Title>
                  <Alert.Description>
                    Devventory could not display this screen.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <p className="text-muted">
                Reload the application to return to a clean state.
              </p>
              <Button
                onPress={() => window.location.reload()}
                variant="primary"
              >
                Reload application
              </Button>
            </Card.Content>
          </Card>
        </main>
      );
    }

    return this.props.children;
  }
}
