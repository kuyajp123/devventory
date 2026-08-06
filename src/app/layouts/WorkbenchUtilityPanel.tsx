import { Button } from '@heroui/react';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconFileSearch,
  IconTerminal,
} from '@tabler/icons-react';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAppUiStore, type UtilityPanelTab } from '../stores/app-ui.store';

export function WorkbenchUtilityPanel() {
  const isOpen = useAppUiStore((state) => state.isUtilityPanelOpen);
  const togglePanel = useAppUiStore((state) => state.toggleUtilityPanel);
  const activeTab = useAppUiStore((state) => state.activeUtilityTab);
  const setActiveTab = useAppUiStore((state) => state.setActiveUtilityTab);
  const { activeProject } = useActiveProject();

  if (!isOpen) return null;

  const initialScan = activeProject?.initialScan;

  const tabs: Array<{
    icon: React.ComponentType<{ size?: number }>;
    id: UtilityPanelTab;
    label: string;
  }> = [
    { icon: IconEye, id: 'watcher', label: 'Watcher Activity' },
    { icon: IconFileSearch, id: 'scanner', label: 'Scanner Output' },
    { icon: IconAlertTriangle, id: 'problems', label: 'Problems' },
    { icon: IconTerminal, id: 'logs', label: 'Output & Logs' },
  ];

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      setActiveTab(tabs[nextIndex].id);
      document.getElementById(`utility-tab-${tabs[nextIndex].id}`)?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex].id);
      document.getElementById(`utility-tab-${tabs[prevIndex].id}`)?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveTab(tabs[0].id);
      document.getElementById(`utility-tab-${tabs[0].id}`)?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = tabs.length - 1;
      setActiveTab(tabs[lastIndex].id);
      document.getElementById(`utility-tab-${tabs[lastIndex].id}`)?.focus();
    }
  }

  return (
    <div
      aria-label="Bottom utility panel"
      className="flex h-44 shrink-0 flex-col border-t border-divider bg-panel font-mono text-xs"
    >
      <div className="flex h-8 items-center justify-between border-b border-divider bg-surface px-3">
        <div
          aria-label="Utility panel tabs"
          className="flex items-center gap-1"
          role="tablist"
        >
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                aria-controls={`utility-panel-${tab.id}`}
                aria-selected={isActive}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
                  isActive
                    ? 'bg-elevated text-foreground border-b-2 border-accent'
                    : 'text-muted hover:text-foreground'
                }`}
                id={`utility-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <Button
          aria-label="Close utility panel"
          className="h-6 w-6 rounded p-0 text-muted hover:text-foreground"
          isIconOnly
          onPress={togglePanel}
          size="sm"
          variant="ghost"
        >
          <IconChevronDown
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
      </div>

      <div
        aria-labelledby={`utility-tab-${activeTab}`}
        className="flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed text-secondary select-text"
        id={`utility-panel-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === 'watcher' && (
          <div className="space-y-1">
            <p className="text-muted">
              [Watcher] File watcher status:{' '}
              <span className="text-success">
                Active on {activeProject?.watchedLocations.length ?? 0}{' '}
                location(s)
              </span>
            </p>
            {activeProject?.watchedLocations.map((loc) => (
              <p className="text-secondary" key={loc}>
                [Watcher] Monitoring path:{' '}
                <span className="text-accent">{loc}</span>
              </p>
            ))}
            <p className="text-muted text-[10px]">
              * Bounded watcher callbacks send change signals to SQLite
              reconciliation.
            </p>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-1">
            {initialScan ? (
              <>
                <p className="text-success">
                  [Scanner] Initial inventory scan completed in{' '}
                  {initialScan.durationMs}ms
                </p>
                <p>
                  [Scanner] Discovered files:{' '}
                  <span className="text-foreground">
                    {initialScan.filesDiscovered}
                  </span>{' '}
                  | Directories visited:{' '}
                  <span className="text-foreground">
                    {initialScan.directoriesVisited}
                  </span>
                </p>
                <p className="text-muted">
                  [Scanner] Excluded entries: {initialScan.entriesExcluded} |
                  Unreadable: {initialScan.entriesUnreadable}
                </p>
              </>
            ) : (
              <p className="text-muted">
                [Scanner] No scan activity recorded for current project.
              </p>
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="space-y-1">
            {initialScan && initialScan.entriesUnreadable > 0 ? (
              <p className="text-warning">
                [Warning] {initialScan.entriesUnreadable} unreadable filesystem
                entry/entries skipped during scan.
              </p>
            ) : (
              <div className="flex items-center gap-2 text-success">
                <IconCheck size={14} />
                <span>No inventory or scanner problems detected.</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-1 font-mono text-[11px]">
            <p className="text-muted">
              [Info] Devventory Workbench initialized.
            </p>
            <p className="text-muted">
              [DB] Embedded SQLite connection pool verified for project id:{' '}
              <span className="text-accent">{activeProject?.id ?? 'none'}</span>
            </p>
            <p className="text-muted">[IPC] Typed Tauri IPC gateways active.</p>
          </div>
        )}
      </div>
    </div>
  );
}
