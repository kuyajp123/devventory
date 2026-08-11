import {
  IconExternalLink,
  IconBell,
  IconGauge,
  IconKey,
  IconX,
} from '@tabler/icons-react';
import { Button, Input, Spinner } from '@heroui/react';
import {
  environmentTrackerGateway,
  type CustomEnvironmentSource,
  type Environment,
} from '@/features/environment-tracker';
import { projectSelectionGateway } from '@/features/projects';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type UnreadReminderState,
  unreadReminderStateSchema,
} from './models/unread-reminder';
import {
  getAgentReminderUnreadState,
  hideQuickAccess,
  openAgentUnreadFromQuickAccess,
  openEnvironmentSettingsFromQuickAccess,
  openMainWindowFromQuickAccess,
  setQuickAccessPreventAutoHide,
} from './services/quick-access.gateway';

const DRAG_PROTECTION_TIMEOUT_MS = 10_000;
const UNREAD_PULSE_DURATION_MS = 5_000;
const UNREAD_CHANGED_EVENT = 'agent-reminders:unread-changed';
const EMPTY_UNREAD_STATE: UnreadReminderState = {
  count: 0,
  pulse: false,
  revision: 0,
};

export function QuickAccessApp() {
  const dragProtectionActive = useRef(false);
  const dragProtectionTimeout = useRef<number | null>(null);
  const latestUnreadRevision = useRef(EMPTY_UNREAD_STATE.revision);
  const unreadPulseTimeout = useRef<number | null>(null);
  const [unreadState, setUnreadState] =
    useState<UnreadReminderState>(EMPTY_UNREAD_STATE);
  const [isUnreadPulsing, setIsUnreadPulsing] = useState(false);
  const [isKeyActionOpen, setIsKeyActionOpen] = useState(false);
  const [isKeyActionLoading, setIsKeyActionLoading] = useState(false);
  const [isKeySaving, setIsKeySaving] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [environmentId, setEnvironmentId] = useState('');
  const [customSources, setCustomSources] = useState<CustomEnvironmentSource[]>(
    [],
  );
  const [sourceId, setSourceId] = useState('');
  const [keyName, setKeyName] = useState('');
  const [keyActionError, setKeyActionError] = useState<string | null>(null);
  const [keyActionSuccess, setKeyActionSuccess] = useState<string | null>(null);

  const handleOpenMain = useCallback(() => {
    void openMainWindowFromQuickAccess();
  }, []);

  const handleClose = useCallback(() => {
    void hideQuickAccess();
  }, []);

  const handleOpenUnread = useCallback(() => {
    void openAgentUnreadFromQuickAccess();
  }, []);

  const openKeyAction = useCallback(async () => {
    setIsKeyActionOpen(true);
    setIsKeyActionLoading(true);
    setKeyActionError(null);
    setKeyActionSuccess(null);
    try {
      const activeProjectId =
        await projectSelectionGateway.getLastOpenedProjectId();
      if (!activeProjectId) {
        setProjectId(null);
        setEnvironments([]);
        setKeyActionError(
          'Open a project in Devventory before adding a custom key.',
        );
        return;
      }
      const nextEnvironments =
        await environmentTrackerGateway.list(activeProjectId);
      const nextEnvironmentId = nextEnvironments[0]?.id ?? '';
      setProjectId(activeProjectId);
      setEnvironments(nextEnvironments);
      setEnvironmentId(nextEnvironmentId);
      setCustomSources([]);
      setSourceId('');
      if (!nextEnvironmentId) {
        setKeyActionError('Create an environment in the main app first.');
        return;
      }
      const sources = await environmentTrackerGateway.listCustomSources(
        activeProjectId,
        nextEnvironmentId,
      );
      setCustomSources(sources);
      setSourceId(sources[0]?.id ?? '');
      if (sources.length === 0) {
        setKeyActionError(
          'This environment has no custom source. Create one in Environment Settings.',
        );
      }
    } catch (error) {
      setKeyActionError(
        commandError(error, 'Environment metadata could not be loaded.'),
      );
    } finally {
      setIsKeyActionLoading(false);
    }
  }, []);

  async function selectEnvironment(nextEnvironmentId: string) {
    setEnvironmentId(nextEnvironmentId);
    setCustomSources([]);
    setSourceId('');
    setKeyActionSuccess(null);
    if (!projectId || !nextEnvironmentId) return;
    setIsKeyActionLoading(true);
    setKeyActionError(null);
    try {
      const sources = await environmentTrackerGateway.listCustomSources(
        projectId,
        nextEnvironmentId,
      );
      setCustomSources(sources);
      setSourceId(sources[0]?.id ?? '');
      if (sources.length === 0) {
        setKeyActionError(
          'This environment has no custom source. Create one in Environment Settings.',
        );
      }
    } catch (error) {
      setKeyActionError(
        commandError(error, 'Custom sources could not be loaded.'),
      );
    } finally {
      setIsKeyActionLoading(false);
    }
  }

  async function saveQuickKey() {
    const name = keyName.trim();
    if (!projectId || !environmentId || !sourceId || !name) return;
    setIsKeySaving(true);
    setKeyActionError(null);
    setKeyActionSuccess(null);
    try {
      await environmentTrackerGateway.addCustomKey({
        environmentId,
        name,
        projectId,
        sourceId,
      });
      setKeyName('');
      setKeyActionSuccess(`${name} was added as metadata only.`);
    } catch (error) {
      setKeyActionError(
        commandError(error, 'The custom key could not be added.'),
      );
    } finally {
      setIsKeySaving(false);
    }
  }

  const applyUnreadState = useCallback(
    (next: UnreadReminderState, acceptEqualRevision = true) => {
      if (
        next.revision < latestUnreadRevision.current ||
        (!acceptEqualRevision && next.revision === latestUnreadRevision.current)
      ) {
        return;
      }

      latestUnreadRevision.current = next.revision;
      setUnreadState(next);

      if (!next.pulse || next.count === 0) {
        setIsUnreadPulsing(false);
        if (unreadPulseTimeout.current !== null) {
          window.clearTimeout(unreadPulseTimeout.current);
          unreadPulseTimeout.current = null;
        }
        return;
      }

      setIsUnreadPulsing(true);
      if (unreadPulseTimeout.current !== null) {
        window.clearTimeout(unreadPulseTimeout.current);
      }
      unreadPulseTimeout.current = window.setTimeout(() => {
        unreadPulseTimeout.current = null;
        setIsUnreadPulsing(false);
      }, UNREAD_PULSE_DURATION_MS);
    },
    [],
  );

  useEffect(() => {
    let isDisposed = false;
    const unlistenPromise = listen<unknown>(UNREAD_CHANGED_EVENT, (event) => {
      const result = unreadReminderStateSchema.safeParse(event.payload);
      if (result.success) {
        applyUnreadState(result.data);
      }
    });

    void unlistenPromise
      .catch(() => undefined)
      .then(() => getAgentReminderUnreadState())
      .then((state) => {
        if (!isDisposed) applyUnreadState(state, false);
      })
      .catch(() => {
        // The Quick Access shell remains usable if the session state is unavailable.
      });

    return () => {
      isDisposed = true;
      void unlistenPromise
        .then((unlisten) => unlisten())
        .catch(() => undefined);
      if (unreadPulseTimeout.current !== null) {
        window.clearTimeout(unreadPulseTimeout.current);
      }
    };
  }, [applyUnreadState]);

  const releaseDragProtection = useCallback(() => {
    if (dragProtectionTimeout.current !== null) {
      window.clearTimeout(dragProtectionTimeout.current);
      dragProtectionTimeout.current = null;
    }

    if (dragProtectionActive.current) {
      dragProtectionActive.current = false;
      void setQuickAccessPreventAutoHide(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', releaseDragProtection);

    return () => {
      window.removeEventListener('mouseup', releaseDragProtection);
      releaseDragProtection();
    };
  }, [releaseDragProtection]);

  const handleStartDrag = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) {
        return;
      }

      void (async () => {
        try {
          await setQuickAccessPreventAutoHide(true);
          dragProtectionActive.current = true;
          dragProtectionTimeout.current = window.setTimeout(
            releaseDragProtection,
            DRAG_PROTECTION_TIMEOUT_MS,
          );
          await getCurrentWindow().startDragging();
        } catch {
          releaseDragProtection();
        }
      })();
    },
    [releaseDragProtection],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden select-none border border-divider bg-background text-foreground shadow-2xl">
      {/* Titlebar Header with Native Drag Region */}
      <header
        className="flex h-11 items-center justify-between border-b border-divider bg-content1/80 px-3 cursor-move select-none"
        onMouseDown={handleStartDrag}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/20 font-mono text-xs font-bold text-accent">
            DV
          </div>
          <span className="font-mono text-xs font-semibold tracking-wide text-foreground">
            Devventory Quick Access
          </span>
        </div>

        {/* Interactive Header Action Buttons - stop propagation so buttons do not trigger drag */}
        <div
          className="flex items-center gap-1 cursor-default"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {unreadState.count > 0 && (
            <button
              aria-label={`Open ${unreadState.count} unread Agent Usage ${unreadState.count === 1 ? 'reminder' : 'reminders'}`}
              className={`flex h-7 items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 font-mono text-[10px] font-semibold text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isUnreadPulsing ? 'animate-pulse' : ''}`}
              onClick={handleOpenUnread}
              type="button"
            >
              <IconBell aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{unreadState.count}</span>
            </button>
          )}
          <button
            aria-label="Open Devventory main window"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-content2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={handleOpenMain}
            type="button"
          >
            <IconExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label="Close Quick Access window"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-danger/20 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            onClick={handleClose}
            type="button"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-3 overflow-y-auto">
        <h2 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          QUICK ACTIONS
        </h2>

        <div className="space-y-2">
          {/* Action Card 1: Environment Key */}
          <button
            aria-expanded={isKeyActionOpen}
            className="flex w-full items-start justify-between rounded-lg border border-divider bg-content1/50 p-3 text-left transition-colors hover:border-accent/40 hover:bg-content1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => void openKeyAction()}
            type="button"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded bg-accent/10 text-accent">
                <IconKey className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-foreground">
                    + Environment Key
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Add a custom environment key
                </p>
              </div>
            </div>
            <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-accent">
              Add
            </span>
          </button>

          {isKeyActionOpen && (
            <section
              aria-label="Add custom environment key"
              className="rounded-lg border border-accent/30 bg-content1 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-mono text-xs font-semibold">
                    Add environment key
                  </h3>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Key name only. Values are never requested or stored.
                  </p>
                </div>
                <button
                  aria-label="Close environment key action"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsKeyActionOpen(false)}
                  type="button"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
              {isKeyActionLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner aria-label="Loading environments" size="sm" />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="block font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Environment
                    <select
                      className="mt-1 h-8 w-full rounded border border-divider bg-content2 px-2 font-mono text-[11px] text-foreground"
                      onChange={(event) =>
                        void selectEnvironment(event.target.value)
                      }
                      value={environmentId}
                    >
                      {environments.map((environment) => (
                        <option key={environment.id} value={environment.id}>
                          {environment.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Custom source
                    <select
                      className="mt-1 h-8 w-full rounded border border-divider bg-content2 px-2 font-mono text-[11px] text-foreground"
                      disabled={customSources.length === 0}
                      onChange={(event) => setSourceId(event.target.value)}
                      value={sourceId}
                    >
                      {customSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                    Key name
                    <Input
                      aria-label="Custom environment key name"
                      className="mt-1"
                      onChange={(event) => setKeyName(event.target.value)}
                      placeholder="SERVICE_ACCOUNT_JSON"
                      value={keyName}
                    />
                  </label>
                  {keyActionError && (
                    <p
                      className="rounded border border-danger/30 bg-danger/10 px-2 py-1.5 text-[10px] leading-relaxed text-danger"
                      role="alert"
                    >
                      {keyActionError}
                    </p>
                  )}
                  {keyActionSuccess && (
                    <p
                      className="rounded border border-success/30 bg-success/10 px-2 py-1.5 text-[10px] leading-relaxed text-success"
                      role="status"
                    >
                      {keyActionSuccess}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    {customSources.length === 0 && (
                      <Button
                        onPress={() =>
                          environmentId
                            ? void openEnvironmentSettingsFromQuickAccess(
                                environmentId,
                              )
                            : handleOpenMain()
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Open Environment Settings
                      </Button>
                    )}
                    <Button
                      isDisabled={
                        !projectId ||
                        !environmentId ||
                        !sourceId ||
                        !keyName.trim()
                      }
                      isPending={isKeySaving}
                      onPress={() => void saveQuickKey()}
                      size="sm"
                      variant="primary"
                    >
                      Add key
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Action Card 2: Quota Window */}
          <div className="flex items-start justify-between rounded-lg border border-divider bg-content1/50 p-3 opacity-80">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded bg-accent/10 text-accent">
                <IconGauge className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-foreground">
                    + Quota Window
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Add an Agent Usage quota window
                </p>
              </div>
            </div>
            <span className="rounded bg-content2 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
              Coming soon
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function commandError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
