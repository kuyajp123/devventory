import {
  IconDatabase,
  IconEye,
  IconFolder,
  IconTerminal,
} from '@tabler/icons-react';
import { useActiveProject } from '@/features/projects';
import { ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAppUiStore } from '../stores/app-ui.store';

export function WorkbenchStatusBar() {
  const { activeProject } = useActiveProject();
  const toggleUtilityPanel = useAppUiStore((state) => state.toggleUtilityPanel);
  const isUtilityOpen = useAppUiStore((state) => state.isUtilityPanelOpen);

  const projectName = activeProject?.name ?? 'No Project';
  const watchedCount = activeProject?.watchedLocations.length ?? 0;
  const filesDiscovered = activeProject?.initialScan?.filesDiscovered ?? 0;

  return (
    <footer
      aria-label="Application status bar"
      className="flex h-6 shrink-0 items-center justify-between border-t border-divider bg-activity-bar px-3 font-mono text-[11px] text-muted select-none"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
          <IconFolder
            aria-hidden="true"
            className="text-accent shrink-0"
            size={12}
            stroke={ICON_STROKE}
          />
          <span className="truncate">{projectName}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-muted">
          <IconEye aria-hidden="true" size={12} />
          <span>
            Watched: {watchedCount} location{watchedCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-muted">
          <IconDatabase aria-hidden="true" className="text-success" size={12} />
          <span>SQLite: Connected</span>
        </div>

        {filesDiscovered > 0 && (
          <div className="hidden lg:flex items-center gap-1 text-muted">
            <span>Indexed: {filesDiscovered.toLocaleString()} files</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline text-muted text-[10px]">v0.1.0</span>

        <button
          aria-label={
            isUtilityOpen ? 'Close output panel' : 'Open output panel'
          }
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
            isUtilityOpen
              ? 'bg-accent-subtle text-accent font-medium'
              : 'text-muted hover:bg-surface-secondary hover:text-foreground'
          }`}
          onClick={toggleUtilityPanel}
          type="button"
        >
          <IconTerminal size={12} />
          <span>Output</span>
        </button>
      </div>
    </footer>
  );
}
