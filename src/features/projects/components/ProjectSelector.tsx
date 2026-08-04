import { Button, toast } from '@heroui/react';
import { IconChevronDown, IconFolder, IconPlus } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useActiveProject } from '../hooks/use-active-project';

interface ProjectSelectorProps {
  compact?: boolean;
}

export function ProjectSelector({ compact = false }: ProjectSelectorProps) {
  const {
    activeProject,
    activeProjectId,
    isHydrating,
    projects,
    selectProject,
  } = useActiveProject();
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  async function chooseProject(projectId: string) {
    try {
      await selectProject(projectId);
      setOpen(false);
      await navigate(moduleDestination(location.pathname), { replace: true });
    } catch {
      toast.danger('The selected project is no longer available.');
    }
  }

  const projectName = activeProject?.name ?? 'No project selected';

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={
          compact ? `Current project: ${projectName}` : 'Select active project'
        }
        className={
          compact
            ? 'h-11 w-full min-w-0 justify-center px-0'
            : 'h-11 w-full min-w-0 justify-between px-3'
        }
        isDisabled={isHydrating}
        isIconOnly={compact}
        onPress={() => setOpen((open) => !open)}
        variant="secondary"
      >
        <span className="flex min-w-0 items-center gap-2">
          <IconFolder
            aria-hidden="true"
            className="shrink-0"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <span className={compact ? 'sr-only' : 'truncate'}>
            {isHydrating ? 'Loading projects…' : projectName}
          </span>
        </span>
        {!compact && (
          <IconChevronDown
            aria-hidden="true"
            className="shrink-0"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        )}
      </Button>

      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-divider bg-surface shadow-lg ${
            compact ? 'left-0 w-64' : 'left-0 right-0 min-w-64'
          }`}
        >
          <div
            aria-label="Available projects"
            className="max-h-64 overflow-y-auto p-2"
            role="listbox"
          >
            {projects.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">
                Add a project to unlock project modules.
              </p>
            ) : (
              projects.map((project) => (
                <button
                  aria-selected={project.id === activeProjectId}
                  className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm transition-colors ${
                    project.id === activeProjectId
                      ? 'bg-accent-soft font-medium text-accent-soft-foreground'
                      : 'text-foreground hover:bg-surface-secondary'
                  }`}
                  key={project.id}
                  onClick={() => void chooseProject(project.id)}
                  role="option"
                  type="button"
                >
                  <span className="truncate">{project.name}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-divider bg-surface p-2">
            <Link
              className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
              onClick={() => setOpen(false)}
              to="/projects/new"
            >
              <IconPlus
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              Add Project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function moduleDestination(pathname: string): string {
  if (pathname === '/diagnostics') return '/diagnostics';
  if (pathname === '/files') return '/files';
  if (pathname === '/assets') return '/assets';
  if (pathname.startsWith('/assets/')) return '/assets';
  return '/dashboard';
}
