import { useAppUiStore } from '@/app/stores/app-ui.store';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { DevventoryDialog, DialogBody } from '@/shared/ui';
import {
  IconAdjustments,
  IconDatabaseSearch,
  IconFiles,
  IconFolder,
  IconLayoutDashboard,
  IconLibrary,
  IconLock,
  IconPlus,
  IconRobot,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconTerminal,
} from '@tabler/icons-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';

interface CommandItem {
  action: () => void;
  category: string;
  icon: typeof IconSearch;
  id: string;
  isCurrent?: boolean;
  label: string;
}

export function GlobalCommandPalette() {
  const isOpen = useAppUiStore((state) => state.isCommandPaletteOpen);
  const setOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
  const toggleUtilityPanel = useAppUiStore((state) => state.toggleUtilityPanel);
  const { activeProject, projects, selectProject } = useActiveProject();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setOpen(!isOpen);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    } else if (!isOpen && wasOpen.current) {
      setTimeout(() => previousFocus.current?.focus(), 0);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  function close() {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }

  function run(action: () => void) {
    action();
    close();
  }

  const items = useMemo<CommandItem[]>(() => {
    const globalItems: CommandItem[] = [
      {
        action: () => run(() => void navigate('/search')),
        category: 'Global',
        icon: IconDatabaseSearch,
        id: 'open-search',
        label: 'Open Global Search',
      },
      {
        action: () => run(() => void navigate('/agent-usage')),
        category: 'Global',
        icon: IconRobot,
        id: 'open-agent-usage',
        label: 'Open Agent Usage',
      },
      {
        action: () => run(() => void navigate('/credential-vault')),
        category: 'Global',
        icon: IconLock,
        id: 'open-credential-vault',
        label: 'Open Credential Vault',
      },
      {
        action: () => run(() => void navigate('/settings')),
        category: 'Global',
        icon: IconSettings,
        id: 'open-settings',
        label: 'Open Settings',
      },
      {
        action: () => run(() => void navigate('/projects/new')),
        category: 'Projects',
        icon: IconPlus,
        id: 'add-project',
        label: 'Add New Project',
      },
      {
        action: () => run(toggleUtilityPanel),
        category: 'Workbench',
        icon: IconTerminal,
        id: 'toggle-utility',
        label: 'Toggle Utility Output Panel',
      },
    ];
    const projectItems: CommandItem[] = activeProject
      ? [
          {
            action: () => run(() => void navigate('/dashboard')),
            category: 'Active project',
            icon: IconLayoutDashboard,
            id: 'open-dashboard',
            label: 'Open Project Overview',
          },
          {
            action: () => run(() => void navigate('/files')),
            category: 'Active project',
            icon: IconFiles,
            id: 'open-files',
            label: 'Open File Inventory',
          },
          {
            action: () => run(() => void navigate('/assets')),
            category: 'Active project',
            icon: IconLibrary,
            id: 'open-assets',
            label: 'Open Asset Library',
          },
          {
            action: () => run(() => void navigate('/environments')),
            category: 'Active project',
            icon: IconAdjustments,
            id: 'open-environments',
            label: 'Open Environment Tracker',
          },
          {
            action: () => run(() => void navigate('/validation')),
            category: 'Active project',
            icon: IconShieldCheck,
            id: 'open-validation',
            label: 'Open Validation Center',
          },
        ]
      : [];
    const switchItems = projects.map<CommandItem>((project) => ({
      action: () =>
        run(() => {
          void selectProject(project.id);
        }),
      category: 'Switch project',
      icon: IconFolder,
      id: `project-${project.id}`,
      isCurrent: project.id === activeProject?.id,
      label: project.name,
    }));
    return [...globalItems, ...projectItems, ...switchItems];
    // run is intentionally local so actions always close the current palette.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject, navigate, projects, selectProject, toggleUtilityPanel]);

  const normalizedQuery = query.trim().toLowerCase();
  const searchItem: CommandItem | null = normalizedQuery
    ? {
        action: () =>
          run(
            () =>
              void navigate(
                `/search?scope=all&q=${encodeURIComponent(query.trim())}`,
              ),
          ),
        category: 'Metadata',
        icon: IconSearch,
        id: 'search-metadata',
        label: `Search Devventory for “${query.trim()}”`,
      }
    : null;
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(normalizedQuery),
  );
  const visibleItems = searchItem ? [...filtered, searchItem] : filtered;
  const boundedSelectedIndex =
    selectedIndex < visibleItems.length ? selectedIndex : 0;

  useEffect(() => {
    if (!isOpen) return;
    const selectedOption = document.getElementById(
      `command-option-${boundedSelectedIndex}`,
    );
    if (typeof selectedOption?.scrollIntoView === 'function') {
      selectedOption.scrollIntoView({ block: 'nearest' });
    }
  }, [boundedSelectedIndex, isOpen]);

  if (!isOpen) return null;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleItems.length > 0
          ? ((index < visibleItems.length ? index : 0) + 1) %
            visibleItems.length
          : 0,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) =>
        visibleItems.length > 0
          ? ((index < visibleItems.length ? index : 0) -
              1 +
              visibleItems.length) %
            visibleItems.length
          : 0,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      visibleItems[boundedSelectedIndex]?.action();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  const activeOption = visibleItems[boundedSelectedIndex]
    ? `command-option-${boundedSelectedIndex}`
    : undefined;

  return (
    <DevventoryDialog
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (nextIsOpen) setOpen(true);
        else close();
      }}
      size="lg"
    >
      <DialogBody className="p-0">
        <div className="flex items-center border-b border-divider px-3 py-2">
          <IconSearch
            aria-hidden="true"
            className="mr-2 text-muted"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <input
            aria-activedescendant={activeOption}
            aria-autocomplete="list"
            aria-controls="global-command-list"
            aria-expanded="true"
            aria-haspopup="listbox"
            autoFocus
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search metadata…"
            role="combobox"
            value={query}
          />
          <kbd className="rounded border border-divider bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted">
            ESC
          </kbd>
        </div>
        <div
          aria-label="Command palette suggestions"
          className="max-h-80 overflow-y-auto p-2"
          id="global-command-list"
          role="listbox"
        >
          {visibleItems.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted">
              No matching commands or projects found.
            </p>
          ) : (
            visibleItems.map((item, index) => (
              <button
                aria-selected={index === boundedSelectedIndex}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors focus:outline-none ${
                  index === boundedSelectedIndex
                    ? 'bg-surface-secondary font-medium text-accent'
                    : 'text-foreground hover:bg-surface-secondary hover:text-accent'
                }`}
                id={`command-option-${index}`}
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <item.icon
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.isCurrent && (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      active
                    </span>
                  )}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {item.category}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogBody>
    </DevventoryDialog>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches(
        'input, textarea, select, [role="textbox"], [role="combobox"]',
      ))
  );
}
