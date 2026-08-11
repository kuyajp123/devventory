import {
  IconExternalLink,
  IconBell,
  IconGauge,
  IconKey,
  IconX,
} from '@tabler/icons-react';
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

  const handleOpenMain = useCallback(() => {
    void openMainWindowFromQuickAccess();
  }, []);

  const handleClose = useCallback(() => {
    void hideQuickAccess();
  }, []);

  const handleOpenUnread = useCallback(() => {
    void openAgentUnreadFromQuickAccess();
  }, []);

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
          <div className="flex items-start justify-between rounded-lg border border-divider bg-content1/50 p-3 opacity-80">
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
            <span className="rounded bg-content2 px-1.5 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
              Coming soon
            </span>
          </div>

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
