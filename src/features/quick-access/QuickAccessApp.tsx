import {
  IconExternalLink,
  IconGauge,
  IconKey,
  IconX,
} from '@tabler/icons-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import {
  hideQuickAccess,
  openMainWindowFromQuickAccess,
  setQuickAccessPreventAutoHide,
} from './services/quick-access.gateway';

const DRAG_PROTECTION_TIMEOUT_MS = 10_000;

export function QuickAccessApp() {
  const dragProtectionActive = useRef(false);
  const dragProtectionTimeout = useRef<number | null>(null);

  const handleOpenMain = useCallback(() => {
    void openMainWindowFromQuickAccess();
  }, []);

  const handleClose = useCallback(() => {
    void hideQuickAccess();
  }, []);

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
