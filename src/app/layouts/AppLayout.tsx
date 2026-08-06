import { Button, toast, useTheme } from '@heroui/react';
import {
  IconActivityHeartbeat,
  IconAdjustments,
  IconCommand,
  IconDeviceDesktop,
  IconFiles,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLibrary,
  IconMoon,
  IconSearch,
  IconSun,
} from '@tabler/icons-react';
import { useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ProjectSelector, useActiveProject } from '@/features/projects';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAppUiStore } from '../stores/app-ui.store';
import { WorkbenchContextSidebar } from './WorkbenchContextSidebar';
import { WorkbenchStatusBar } from './WorkbenchStatusBar';
import { WorkbenchUtilityPanel } from './WorkbenchUtilityPanel';

const navigationItems = [
  {
    icon: IconLayoutDashboard,
    label: 'Dashboard',
    requiresProject: false,
    to: '/dashboard',
  },
  {
    icon: IconFiles,
    label: 'File Inventory',
    requiresProject: true,
    to: '/files',
  },
  {
    icon: IconLibrary,
    label: 'Asset Library',
    requiresProject: true,
    to: '/assets',
  },
  {
    icon: IconAdjustments,
    label: 'Environment Tracker',
    requiresProject: true,
    to: '/environments',
  },
  {
    icon: IconActivityHeartbeat,
    label: 'Diagnostics',
    requiresProject: false,
    to: '/diagnostics',
  },
];

function isNavigationDisabled(
  item: (typeof navigationItems)[number],
  isHydrating: boolean,
  hasProjects: boolean,
): boolean {
  if (item.to === '/diagnostics') return false;
  if (isHydrating) return true;
  return item.requiresProject && !hasProjects;
}

export function AppLayout() {
  const toggleCommandPalette = useAppUiStore(
    (state) => state.toggleCommandPalette,
  );
  const isContextSidebarCollapsed = useAppUiStore(
    (state) => state.isContextSidebarCollapsed,
  );
  const toggleContextSidebar = useAppUiStore(
    (state) => state.toggleContextSidebar,
  );
  const { activeProject, hasProjects, isHydrating } = useActiveProject();
  const { setTheme, theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarToggleRef = useRef<HTMLButtonElement | null>(null);

  const currentModuleName =
    navigationItems.find(
      (item) =>
        location.pathname === item.to ||
        (item.to !== '/dashboard' && location.pathname.startsWith(item.to)),
    )?.label ?? 'Workbench';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none">
      {/* 1. Top Application Bar */}
      <header
        aria-label="Top application bar"
        className="flex h-11 shrink-0 items-center justify-between border-b border-divider bg-surface px-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 pr-2 font-mono text-xs font-bold tracking-tight text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-slate-950 font-mono text-xs font-black">
              DV
            </span>
            <span>Devventory</span>
          </div>

          <div className="h-4 w-px bg-divider" />

          <div className="min-w-44 max-w-64">
            <ProjectSelector />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded border border-divider bg-workspace px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-foreground"
            onClick={toggleCommandPalette}
            type="button"
          >
            <IconSearch size={13} />
            <span className="hidden sm:inline font-sans text-xs">
              Search or type command…
            </span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-divider bg-surface-secondary px-1 font-mono text-[10px] text-muted">
              <IconCommand size={10} />K
            </kbd>
          </button>

          <Button
            aria-label={
              isContextSidebarCollapsed
                ? 'Expand context sidebar'
                : 'Collapse context sidebar'
            }
            className="h-7 w-7 text-muted hover:text-foreground"
            isIconOnly
            onPress={toggleContextSidebar}
            ref={sidebarToggleRef}
            size="sm"
            variant="ghost"
          >
            {isContextSidebarCollapsed ? (
              <IconLayoutSidebarLeftExpand
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconLayoutSidebarLeftCollapse
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
          </Button>

          <Button
            aria-label={`Current theme: ${theme}. Click to change theme.`}
            className="h-7 w-7 text-muted hover:text-foreground"
            isIconOnly
            onPress={() => {
              const nextTheme =
                theme === 'light'
                  ? 'dark'
                  : theme === 'dark'
                    ? 'system'
                    : 'light';
              setTheme(nextTheme);
            }}
            size="sm"
            variant="ghost"
          >
            {theme === 'light' ? (
              <IconSun
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : theme === 'dark' ? (
              <IconMoon
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconDeviceDesktop
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
          </Button>
        </div>
      </header>

      {/* Main Grid: Activity Bar + Context Sidebar + Workspace Surface */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* 2. Primary Activity Navigation Bar */}
        <nav
          aria-label="Primary navigation"
          className="flex w-12 shrink-0 flex-col items-center border-r border-divider bg-activity-bar py-2 space-y-1 z-20"
        >
          {navigationItems.map((item) => {
            const disabled = isNavigationDisabled(
              item,
              isHydrating,
              hasProjects,
            );
            if (disabled) {
              return (
                <button
                  aria-label={`${item.label} (requires active project)`}
                  className="flex h-9 w-9 items-center justify-center rounded text-muted opacity-40 transition-opacity hover:opacity-75 focus:outline-none focus:ring-1 focus:ring-accent"
                  key={item.to}
                  onClick={() => {
                    toast.warning(
                      `An active project is required to access ${item.label}.`,
                    );
                    void navigate('/projects/new');
                  }}
                  type="button"
                >
                  <item.icon
                    aria-hidden="true"
                    size={18}
                    stroke={ICON_STROKE}
                  />
                </button>
              );
            }

            return (
              <NavLink
                aria-label={item.label}
                className={({ isActive }) =>
                  `group relative flex h-9 w-9 items-center justify-center rounded transition-colors ${
                    isActive
                      ? 'bg-elevated text-accent font-semibold'
                      : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                  }`
                }
                end={item.to === '/dashboard' || item.to === '/diagnostics'}
                key={item.to}
                title={item.label}
                to={item.to}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
                    )}
                    <item.icon
                      aria-hidden="true"
                      size={18}
                      stroke={ICON_STROKE}
                    />
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* 3. Context Sidebar */}
        <WorkbenchContextSidebar toggleButtonRef={sidebarToggleRef} />

        {/* 4. Main Workspace Surface */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0 bg-workspace">
          {/* Breadcrumb Workspace Header */}
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-divider bg-surface px-4 font-mono text-xs text-muted">
            <div className="flex items-center gap-2 truncate">
              <span>Devventory</span>
              <span>/</span>
              <span className="text-foreground">
                {activeProject?.name ?? 'Workspace'}
              </span>
              <span>/</span>
              <span className="text-accent">{currentModuleName}</span>
            </div>
          </div>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>

          {/* 5. Bottom Utility Output Panel */}
          <WorkbenchUtilityPanel />
        </div>
      </div>

      {/* 6. Status Bar */}
      <WorkbenchStatusBar />

      {/* Command Palette Overlay */}
      <CommandPalette />
    </div>
  );
}
