import { Button } from '@heroui/react';
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
    } catch {
      setStatus({
        state: 'error',
        message: 'Unable to communicate with the desktop backend.',
      });
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

      <div className="rounded-2xl border border-divider bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Desktop backend</h2>
            <p aria-live="polite" className="text-sm text-muted">
              {status.message}
            </p>
          </div>

          <Button
            isDisabled={status.state === 'loading'}
            onPress={handleHealthCheck}
            variant="primary"
          >
            {status.state === 'loading'
              ? 'Checking…'
              : 'Check desktop connection'}
          </Button>
        </div>
      </div>
    </section>
  );
}
