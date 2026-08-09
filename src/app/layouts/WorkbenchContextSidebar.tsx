import { Button } from '@heroui/react';
import {
  IconChevronRight,
  IconFolder,
  IconLayoutSidebarLeftCollapse,
  IconLibrary,
  IconRobot,
  IconShield,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  useActiveProject,
} from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAppUiStore } from '../stores/app-ui.store';

interface WorkbenchContextSidebarProps {
  toggleButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function WorkbenchContextSidebar({
  toggleButtonRef,
}: WorkbenchContextSidebarProps) {
  const isCollapsed = useAppUiStore((state) => state.isContextSidebarCollapsed);
  const toggleSidebar = useAppUiStore((state) => state.toggleContextSidebar);
  const { activeProject } = useActiveProject();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (isCollapsed) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        toggleSidebar();
        toggleButtonRef?.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, toggleSidebar, toggleButtonRef]);

  if (isCollapsed) {
    return null;
  }

  const currentCategory = searchParams.get('category');
  const currentStatus = searchParams.get('status');

  function setFilter(key: string, value?: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  }

  function handleCloseSidebar() {
    toggleSidebar();
    toggleButtonRef?.current?.focus();
  }

  return (
    <>
      {/* Mobile/Tablet Overlay Backdrop (below 1024px) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        onClick={handleCloseSidebar}
      />

      <aside
        aria-label="Context sidebar"
        className="fixed inset-y-0 left-12 z-40 flex w-60 flex-col border-r border-divider bg-sidebar shadow-2xl transition-all lg:static lg:z-auto lg:shadow-none"
      >
        <div className="flex h-10 items-center justify-between border-b border-divider px-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
            Explorer
          </span>
          <Button
            aria-label="Collapse context sidebar"
            className="h-6 w-6 rounded p-0 text-muted hover:text-foreground"
            isIconOnly
            onPress={handleCloseSidebar}
            size="sm"
            variant="ghost"
          >
            <IconLayoutSidebarLeftCollapse
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {location.pathname === '/dashboard' && (
            <>
              <SidebarSection title="Active Project">
                <div className="rounded-md border border-divider bg-workspace p-2.5 space-y-1.5">
                  <p className="font-mono text-xs font-semibold text-foreground truncate">
                    {activeProject?.name ?? 'No Project'}
                  </p>
                  <p className="font-mono text-[10px] text-muted capitalize">
                    Type: {activeProject?.projectType ?? 'N/A'}
                  </p>
                  {activeProject?.rootPath && (
                    <p
                      className="font-mono text-[10px] text-muted truncate"
                      title={activeProject.rootPath}
                    >
                      Root: {activeProject.rootPath}
                    </p>
                  )}
                </div>
              </SidebarSection>

              {activeProject?.watchedLocations &&
                activeProject.watchedLocations.length > 0 && (
                  <SidebarSection title="Watched Locations">
                    <ul className="space-y-1 font-mono text-xs">
                      {activeProject.watchedLocations.map((loc) => (
                        <li
                          className="flex items-center gap-2 rounded px-2 py-1 bg-panel text-secondary"
                          key={loc}
                        >
                          <IconFolder
                            aria-hidden="true"
                            className="text-accent shrink-0"
                            size={ICON_SIZE.small}
                          />
                          <span className="truncate">{loc}</span>
                        </li>
                      ))}
                    </ul>
                  </SidebarSection>
                )}

              {activeProject?.exclusions &&
                activeProject.exclusions.length > 0 && (
                  <SidebarSection title="Additional Exclusions">
                    <ul className="space-y-1 font-mono text-xs">
                      {activeProject.exclusions.map((ex) => (
                        <li
                          className="flex items-center gap-2 rounded px-2 py-1 bg-panel text-muted"
                          key={ex}
                        >
                          <IconShield
                            aria-hidden="true"
                            className="shrink-0 text-warning"
                            size={ICON_SIZE.small}
                          />
                          <span className="truncate">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </SidebarSection>
                )}

              {activeProject && (
                <SidebarSection title="Built-in Exclusions">
                  <p className="mb-2 text-[10px] leading-relaxed text-muted">
                    Applied automatically and managed by Devventory.
                  </p>
                  <ul className="flex flex-wrap gap-1 font-mono text-[10px]">
                    {DEFAULT_PROJECT_EXCLUSIONS.map((exclusion) => (
                      <li
                        className="rounded border border-divider bg-panel px-1.5 py-0.5 text-muted"
                        key={exclusion}
                      >
                        {exclusion}
                      </li>
                    ))}
                  </ul>
                </SidebarSection>
              )}
            </>
          )}

          {location.pathname === '/agent-usage' && (
            <>
              <SidebarSection title="Global Tracking">
                <div className="rounded-md border border-divider bg-workspace p-2.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <IconRobot
                      aria-hidden="true"
                      className="text-accent"
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                    Coding-agent availability
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Accounts, reset windows, and reminders are global. Switching
                    the active project does not change this data.
                  </p>
                </div>
              </SidebarSection>
              <SidebarSection title="Tracking Policy">
                <p className="rounded-md border border-divider bg-panel p-2.5 text-xs leading-relaxed text-muted">
                  Manual tracking is always available. Devventory does not read
                  provider credentials, cookies, or private authentication
                  files.
                </p>
              </SidebarSection>
            </>
          )}

          {location.pathname === '/files' && (
            <>
              <SidebarSection title="Categories">
                <div className="space-y-1">
                  {[
                    { label: 'All Files', value: undefined },
                    { label: 'Code', value: 'code' },
                    { label: 'Documentation', value: 'documentation' },
                    { label: 'Configuration', value: 'config' },
                    { label: 'Assets', value: 'asset' },
                    { label: 'Data', value: 'data' },
                  ].map((item) => {
                    const isActive = currentCategory === item.value;
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-secondary hover:bg-panel hover:text-foreground'
                        }`}
                        key={item.label}
                        onClick={() => setFilter('category', item.value)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        {isActive && (
                          <IconChevronRight
                            aria-hidden="true"
                            className="shrink-0"
                            size={14}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </SidebarSection>

              <SidebarSection title="File Status">
                <div className="space-y-1">
                  {[
                    { label: 'All Statuses', value: undefined },
                    { label: 'Discovered', value: 'discovered' },
                    { label: 'Managed', value: 'managed' },
                    { label: 'Missing', value: 'missing' },
                  ].map((item) => {
                    const isActive = currentStatus === item.value;
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-secondary hover:bg-panel hover:text-foreground'
                        }`}
                        key={item.label}
                        onClick={() => setFilter('status', item.value)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        {isActive && (
                          <IconChevronRight
                            aria-hidden="true"
                            className="shrink-0"
                            size={14}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </SidebarSection>
            </>
          )}

          {location.pathname.startsWith('/assets') && (
            <>
              <SidebarSection title="Asset Types">
                <div className="space-y-1">
                  {[
                    { label: 'All Assets', value: undefined },
                    { label: 'Images & Vectors', value: 'image' },
                    { label: 'Fonts', value: 'font' },
                    { label: 'Documents', value: 'document' },
                    { label: 'Code & Schemas', value: 'code' },
                  ].map((item) => {
                    const isActive = currentCategory === item.value;
                    return (
                      <button
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-secondary hover:bg-panel hover:text-foreground'
                        }`}
                        key={item.label}
                        onClick={() => setFilter('category', item.value)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        {isActive && (
                          <IconChevronRight
                            aria-hidden="true"
                            className="shrink-0"
                            size={14}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </SidebarSection>

              <SidebarSection title="Asset View">
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-secondary hover:bg-panel hover:text-foreground"
                  onClick={() => navigate('/assets')}
                  type="button"
                >
                  <IconLibrary size={14} />
                  <span>Browse All Assets</span>
                </button>
              </SidebarSection>
            </>
          )}

          {location.pathname === '/environments' && (
            <>
              <SidebarSection title="Environment Views">
                <div className="space-y-1 text-xs">
                  <div className="rounded border border-divider bg-workspace p-2 font-mono text-[11px] text-muted space-y-1">
                    <p className="font-semibold text-foreground">
                      Offline Secrets
                    </p>
                    <p>
                      Structural key names and schemas only. Persistent values
                      are never stored.
                    </p>
                  </div>
                </div>
              </SidebarSection>
            </>
          )}

          {location.pathname === '/validation' && (
            <>
              <SidebarSection title="Validation Safety">
                <div className="rounded border border-divider bg-workspace p-2 font-mono text-[11px] text-muted space-y-1">
                  <p className="font-semibold text-foreground">Metadata only</p>
                  <p>
                    Rules, key names, source paths, and issue lifecycle are
                    local. Values are never persisted.
                  </p>
                </div>
              </SidebarSection>
            </>
          )}

          {location.pathname === '/diagnostics' && (
            <>
              <SidebarSection title="System Diagnostics">
                <div className="space-y-2 font-mono text-xs text-muted">
                  <div className="flex justify-between items-center py-1 border-b border-divider">
                    <span>Engine:</span>
                    <span className="text-foreground">Tauri v2</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-divider">
                    <span>Storage:</span>
                    <span className="text-success">SQLite (SQLx)</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-divider">
                    <span>Mode:</span>
                    <span className="text-info">Offline-First</span>
                  </div>
                </div>
              </SidebarSection>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}
