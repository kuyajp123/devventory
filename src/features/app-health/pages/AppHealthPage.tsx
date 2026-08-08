import { Alert, Button, Chip, Spinner, toast } from '@heroui/react';
import { IconActivityHeartbeat } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
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
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="border-b border-divider pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <IconActivityHeartbeat
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Diagnostics
          </h1>
        </div>
        <p className="text-xs text-muted max-w-2xl">
          Verify that the React interface can reach the local Rust command
          layer. No network or cloud service is involved.
        </p>
      </header>

      <div className="rounded-md border border-divider bg-surface p-5 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-sm font-semibold text-foreground">
                Desktop backend
              </h2>
              <HealthStatusChip state={status.state} />
            </div>
            <p aria-live="polite" className="font-mono text-xs text-muted">
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
        </div>
      </div>

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
      <Chip.Label className="font-mono text-[10px]">{label}</Chip.Label>
    </Chip>
  );
}
