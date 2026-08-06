import { Modal } from '@heroui/react';
import {
  IconActivityHeartbeat,
  IconAdjustments,
  IconFiles,
  IconFolder,
  IconLayoutDashboard,
  IconLibrary,
  IconPlus,
  IconSearch,
  IconTerminal,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAppUiStore } from '@/app/stores/app-ui.store';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

export function CommandPalette() {
  const isOpen = useAppUiStore((state) => state.isCommandPaletteOpen);
  const setOpen = useAppUiStore((state) => state.setCommandPaletteOpen);
  const toggleUtilityPanel = useAppUiStore((state) => state.toggleUtilityPanel);
  const { activeProject, projects, selectProject } = useActiveProject();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(!isOpen);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  function runAction(action: () => void) {
    action();
    setOpen(false);
    setQuery('');
  }

  const items = [
    {
      action: () => runAction(() => void navigate('/dashboard')),
      category: 'Navigation',
      icon: IconLayoutDashboard,
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
    },
    {
      action: () => runAction(() => void navigate('/files')),
      category: 'Navigation',
      icon: IconFiles,
      id: 'nav-files',
      label: 'Go to File Inventory',
    },
    {
      action: () => runAction(() => void navigate('/assets')),
      category: 'Navigation',
      icon: IconLibrary,
      id: 'nav-assets',
      label: 'Go to Asset Library',
    },
    {
      action: () => runAction(() => void navigate('/environments')),
      category: 'Navigation',
      icon: IconAdjustments,
      id: 'nav-environments',
      label: 'Go to Environment Tracker',
    },
    {
      action: () => runAction(() => void navigate('/diagnostics')),
      category: 'Navigation',
      icon: IconActivityHeartbeat,
      id: 'nav-diagnostics',
      label: 'Go to Diagnostics',
    },
    {
      action: () => runAction(() => void navigate('/projects/new')),
      category: 'Projects',
      icon: IconPlus,
      id: 'proj-new',
      label: 'Add New Project',
    },
    {
      action: () => runAction(() => toggleUtilityPanel()),
      category: 'Workbench',
      icon: IconTerminal,
      id: 'toggle-utility',
      label: 'Toggle Utility Output Panel',
    },
  ];

  const projectItems = projects.map(
    (project) =>
      ({
        action: () =>
          runAction(() => {
            void selectProject(project.id);
          }),
        category: 'Switch Project',
        icon: IconFolder,
        id: `proj-${project.id}`,
        label: project.name,
        isCurrent: project.id === activeProject?.id,
      }) as const,
  );

  const allItems = [...items, ...projectItems];
  const filtered = query.trim()
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()),
      )
    : allItems;

  // Scroll the currently selected item into view
  useEffect(() => {
    if (!isOpen) return;
    const activeElement = document.getElementById(
      `cmd-option-${selectedIndex}`,
    );
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0 ? (prev + 1) % filtered.length : 0,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0
          ? (prev - 1 + filtered.length) % filtered.length
          : 0,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  }

  const activeOptionId =
    filtered.length > 0 && selectedIndex >= 0 && selectedIndex < filtered.length
      ? `cmd-option-${selectedIndex}`
      : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <Modal.Backdrop />
      <Modal.Container>
        <Modal.Dialog className="overflow-hidden rounded-md border border-divider bg-surface shadow-2xl">
          <div className="flex items-center border-b border-divider px-3 py-2">
            <IconSearch
              aria-hidden="true"
              className="mr-2 text-muted"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            <input
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              aria-controls="command-palette-listbox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              autoFocus
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a command or search project…"
              role="combobox"
              value={query}
            />
            <kbd className="inline-flex items-center rounded border border-divider bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted">
              ESC
            </kbd>
          </div>

          <div
            aria-label="Command palette suggestions"
            className="max-h-80 overflow-y-auto p-2"
            id="command-palette-listbox"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted">
                No matching commands or projects found.
              </p>
            ) : (
              filtered.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors focus:outline-none ${
                      isSelected
                        ? 'bg-surface-secondary text-accent font-medium'
                        : 'text-foreground hover:bg-surface-secondary hover:text-accent'
                    }`}
                    id={`cmd-option-${index}`}
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    role="option"
                    type="button"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.icon
                        aria-hidden="true"
                        className="shrink-0 text-muted"
                        size={ICON_SIZE.button}
                        stroke={ICON_STROKE}
                      />
                      <span className="truncate">{item.label}</span>
                      {'isCurrent' in item && item.isCurrent && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                          active
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted">
                      {item.category}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}
