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
  const inventoryScans: Record<string, Array<Record<string, unknown>>> = {};

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
    if (command === 'list_project_files') {
      const input = commandArguments(args).input as {
        projectId: string;
        page: number;
        pageSize: number;
      };
      return {
        items: [
          {
            category: 'source',
            extension: 'ts',
            firstSeenAt: '2026-08-02T00:00:00.000Z',
            id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
            lastSeenAt: '2026-08-02T00:00:00.000Z',
            mimeType: 'video/mp2t',
            modifiedAtMs: 1_775_257_200_000,
            name: 'main.ts',
            projectId: input.projectId,
            relativePath: 'src/main.ts',
            sizeBytes: 1536,
            sourceType: 'discovered',
            status: 'active',
            updatedAt: '2026-08-02T00:00:00.000Z',
            watchedLocationId: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
          },
        ],
        page: input.page,
        pageSize: input.pageSize,
        recentScans: inventoryScans[input.projectId] ?? [],
        totalItems: 1,
        totalPages: 1,
        watchedLocations: [
          {
            id: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
            relativePath: '.',
          },
        ],
      };
    }
    if (command === 'rescan_project' || command === 'rescan_watched_location') {
      const commandArgs = commandArguments(args);
      const projectId = commandArgs.projectId as string;
      const scan = {
        completedAt: '2026-08-02T00:00:01.000Z',
        directoriesVisited: 3,
        durationMs: 18,
        entriesExcluded: 1,
        entriesUnreadable: 0,
        errorSummary: null,
        filesAdded: 0,
        filesDiscovered: 1,
        filesMissing: 0,
        filesUnchanged: 1,
        filesUpdated: 0,
        id: 'b3e91b34-6629-4ff4-b92a-b3c65d7b1093',
        projectId,
        scanType:
          command === 'rescan_project' ? 'manual_project' : 'manual_location',
        startedAt: '2026-08-02T00:00:00.000Z',
        status: 'completed',
        watchedLocationId:
          command === 'rescan_watched_location'
            ? (commandArgs.watchedLocationId as string)
            : null,
      };
      inventoryScans[projectId] = [scan];
      return scan;
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
