import { Alert, Button, Card, Chip, Spinner, toast } from '@heroui/react';
import { useState } from 'react';
import { appHealthGateway } from '../services/app-health.gateway';

type HealthStatus =
  | { state: 'idle'; message: 'Not checked yet.' }
  | { state: 'loading'; message: 'Checking the desktop backend…' }
  | { state: 'success'; message: string }
  | {
      state: 'error';
      message: 'Unable to communicate with the desktop backend.';
    };

const initialStatus: HealthStatus = {
  state: 'idle',
  message: 'Not checked yet.',
};

export function AppHealthPage() {
  const [status, setStatus] = useState<HealthStatus>(initialStatus);

  async function handleHealthCheck() {
    setStatus({ state: 'loading', message: 'Checking the desktop backend…' });

    try {
      const message = await appHealthGateway.check();
      setStatus({ state: 'success', message });
      toast.success('Desktop backend is reachable');
    } catch {
      setStatus({
        state: 'error',
        message: 'Unable to communicate with the desktop backend.',
      });
      toast.danger('Desktop backend could not be reached');
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted">Foundation check</p>
        <h1 className="text-3xl font-semibold tracking-tight">Diagnostics</h1>
        <p className="max-w-2xl text-muted">
          Verify that the React interface can reach the local Rust command
          layer. No network or cloud service is involved.
        </p>
      </header>

      <Card>
        <Card.Content className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Desktop backend</h2>
              <HealthStatusChip state={status.state} />
            </div>
            <p aria-live="polite" className="text-sm text-muted">
              {status.message}
            </p>
          </div>

          <Button
            isDisabled={status.state === 'loading'}
            onPress={handleHealthCheck}
            variant="primary"
          >
            {status.state === 'loading' ? (
              <>
                <Spinner size="sm" /> Checking…
              </>
            ) : (
              'Check desktop connection'
            )}
          </Button>
        </Card.Content>
      </Card>

      {status.state === 'error' && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Desktop connection failed</Alert.Title>
            <Alert.Description>
              Restart the desktop application and try the check again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </section>
  );
}

function HealthStatusChip({ state }: { state: HealthStatus['state'] }) {
  const label = {
    error: 'Unavailable',
    idle: 'Not checked',
    loading: 'Checking',
    success: 'Connected',
  }[state];
  const color =
    state === 'success' ? 'success' : state === 'error' ? 'danger' : 'default';

  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
