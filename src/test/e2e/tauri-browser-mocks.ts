import { mockIPC } from '@tauri-apps/api/mocks';
import type { Project } from '@/features/projects';

const scanSummary = {
  completed: true,
  directoriesVisited: 18,
  durationMs: 32,
  entriesExcluded: 4,
  entriesUnreadable: 0,
  filesDiscovered: 73,
};

export function installTauriBrowserMocks() {
  const projects: Project[] = [];

  mockIPC((command, args) => {
    if (command === 'health_check') {
      return 'Devventory Rust backend is running';
    }
    if (command === 'plugin:dialog|open') {
      return 'C:\\workspace\\browser-project';
    }
    if (command === 'validate_project_root') {
      const input = commandArguments(args).input as { rootPath: string };
      return { rootPath: input.rootPath };
    }
    if (command === 'scan_project_root') {
      return scanSummary;
    }
    if (command === 'create_project') {
      const input = commandArguments(args).input as {
        description?: string;
        exclusions: string[];
        name: string;
        projectType: Project['projectType'];
        rootPath: string;
        watchedLocations: string[];
      };
      const project: Project = {
        ...input,
        createdAt: '2026-08-01T00:00:00.000Z',
        description: input.description ?? null,
        id: '44c34308-a8bd-4770-b7af-8172e713b39a',
        initialScan: scanSummary,
        updatedAt: '2026-08-01T00:00:00.000Z',
      };
      projects.push(project);
      return project;
    }
    if (command === 'list_projects') {
      return projects;
    }
    if (command === 'get_project') {
      return projects.find(
        (project) => project.id === commandArguments(args).projectId,
      );
    }

    throw new Error(`Unhandled E2E command: ${command}`);
  });
}

function commandArguments(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error('Invalid E2E command arguments');
  }
  return args as Record<string, unknown>;
}
