import { Alert, Button, Spinner, toast } from '@heroui/react';
import { IconActivityHeartbeat, IconBell } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { SemanticStatusChip } from '@/shared/ui';
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
  message: 'Not checked yet.',
  state: 'idle',
};

export function AppHealthPage() {
  const [status, setStatus] = useState<HealthStatus>(initialStatus);
  const [isTestNormalLoading, setIsTestNormalLoading] = useState(false);
  const [isTestSystemLoading, setIsTestSystemLoading] = useState(false);

  async function handleHealthCheck() {
    setStatus({ message: 'Checking the desktop backend…', state: 'loading' });

    try {
      const message = await appHealthGateway.check();
      setStatus({ message, state: 'success' });
      toast.success('Desktop backend is reachable');
    } catch {
      setStatus({
        message: 'Unable to communicate with the desktop backend.',
        state: 'error',
      });
      toast.danger('Desktop backend could not be reached');
    }
  }

  async function handleTestNormalNotification() {
    setIsTestNormalLoading(true);
    try {
      const result = await invokeCommand<string>('test_normal_notification');
      toast.success(`Diagnostic result: ${result}`);
    } catch (err) {
      toast.danger(`Diagnostic failed: ${String(err)}`);
    } finally {
      setIsTestNormalLoading(false);
    }
  }

  async function handleTestSystemChannelDirectly() {
    setIsTestSystemLoading(true);
    try {
      const result = await invokeCommand<string>(
        'test_system_channel_directly',
      );
      toast.success(`Direct System result: ${result}`);
    } catch (err) {
      toast.danger(`Direct System failed: ${String(err)}`);
    } finally {
      setIsTestSystemLoading(false);
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
        <p className="max-w-2xl text-xs text-muted">
          Verify that the React interface can reach the local Rust command
          layer. No network or cloud service is involved.
        </p>
      </header>

      <div className="space-y-4 rounded-md border border-divider bg-surface p-5">
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

      {/* Developer Diagnostic Notification Tests */}
      {import.meta.env.DEV && (
        <div className="space-y-4 rounded-md border border-divider bg-surface p-5">
          <div className="flex items-center gap-2 border-b border-divider pb-3">
            <IconBell
              aria-hidden="true"
              className="text-accent"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
            <h2 className="font-mono text-sm font-semibold text-foreground">
              Notification System Diagnostics
            </h2>
          </div>
          <p className="text-xs text-muted">
            Developer diagnostic triggers using production notification routing
            and native adapters. Synthetic notifications do not create database
            records or alter quota schedules.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              isDisabled={isTestNormalLoading}
              onPress={handleTestNormalNotification}
              size="sm"
              variant="secondary"
            >
              {isTestNormalLoading ? (
                <Spinner size="sm" />
              ) : (
                'Test normal notification'
              )}
            </Button>
            <Button
              isDisabled={isTestSystemLoading}
              onPress={handleTestSystemChannelDirectly}
              size="sm"
              variant="secondary"
            >
              {isTestSystemLoading ? (
                <Spinner size="sm" />
              ) : (
                'Test system channel directly'
              )}
            </Button>
          </div>
        </div>
      )}

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
  const tone =
    state === 'success' ? 'success' : state === 'error' ? 'danger' : 'neutral';

  return (
    <SemanticStatusChip
      dataStatus={state}
      label={label}
      labelClassName="font-mono text-[10px]"
      tone={tone}
    />
  );
}
