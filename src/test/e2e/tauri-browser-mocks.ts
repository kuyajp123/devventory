import { mockIPC } from '@tauri-apps/api/mocks';
import type { Project } from '@/features/projects';

const MOCK_DATABASE_KEY = 'devventory.e2e.database';
const LAST_OPENED_PROJECT_KEY = 'workspace.last_opened_project_id';

interface MockDatabase {
  environments: Record<string, Array<Record<string, unknown>>>;
  inventoryScans: Record<string, Array<Record<string, unknown>>>;
  managedAssets: Array<Record<string, unknown>>;
  projects: Project[];
  settings: Record<string, string>;
  variantIdsByAsset: Record<string, string[]>;
}

const scanSummary = {
  completed: true,
  directoriesVisited: 18,
  durationMs: 32,
  entriesExcluded: 4,
  entriesUnreadable: 0,
  filesDiscovered: 73,
};

export function installTauriBrowserMocks() {
  const database = loadDatabase();
  const projects = database.projects;
  const inventoryScans = database.inventoryScans;
  const managedAssets = database.managedAssets;
  const variantIdsByAsset = new Map<string, string[]>(
    Object.entries(database.variantIdsByAsset),
  );
  const suggestedVariant = {
    category: 'image',
    extension: 'png',
    id: 'cc1ab2f3-91af-4190-b87a-2212d09ff66c',
    name: 'logo-dark.png',
    origin: 'discovered',
    reasons: {
      compatibleType: true,
      matchingMetadata: false,
      sameAssetRoot: true,
      sameFolder: true,
      similarName: true,
    },
    relativePath: 'assets/branding/logo-dark.png',
    status: 'active',
  };

  function persist() {
    database.variantIdsByAsset = Object.fromEntries(variantIdsByAsset);
    localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(database));
  }

  mockIPC((command, args) => {
    if (command === 'health_check') {
      return 'Devventory Rust backend is running';
    }
    if (command === 'plugin:dialog|open') {
      return 'C:\\workspace\\browser-project';
    }
    if (command === 'get_last_opened_project_id') {
      return database.settings[LAST_OPENED_PROJECT_KEY] ?? null;
    }
    if (command === 'save_last_opened_project_id') {
      database.settings[LAST_OPENED_PROJECT_KEY] = commandArguments(args)
        .projectId as string;
      persist();
      return null;
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
      projects.splice(
        0,
        projects.length,
        project,
        ...projects.filter((item) => item.id !== project.id),
      );
      persist();
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
    if (command === 'list_environments') {
      const input = commandArguments(args).input as { projectId: string };
      return database.environments[input.projectId] ?? [];
    }
    if (command === 'create_environment') {
      const input = commandArguments(args).input as {
        description?: string;
        name: string;
        projectId: string;
      };
      const items = database.environments[input.projectId] ?? [];
      const environment = {
        createdAt: '2026-08-04T00:00:00.000Z',
        description: input.description || null,
        id: crypto.randomUUID(),
        name: input.name,
        projectId: input.projectId,
        sortOrder: items.length,
        sources: [],
        updatedAt: '2026-08-04T00:00:00.000Z',
      };
      items.push(environment);
      database.environments[input.projectId] = items;
      persist();
      return environment;
    }
    if (command === 'update_environment') {
      const input = commandArguments(args).input as {
        description?: string;
        environmentId: string;
        name: string;
        projectId: string;
      };
      const environment = (database.environments[input.projectId] ?? []).find(
        (item) => item.id === input.environmentId,
      );
      if (!environment) throw new Error('Missing environment in E2E mock');
      environment.name = input.name;
      environment.description = input.description || null;
      environment.updatedAt = '2026-08-04T00:00:00.000Z';
      persist();
      return environment;
    }
    if (command === 'delete_environment') {
      const input = commandArguments(args).input as {
        environmentId: string;
        projectId: string;
      };
      database.environments[input.projectId] = (
        database.environments[input.projectId] ?? []
      )
        .filter((item) => item.id !== input.environmentId)
        .map((item, index) => ({ ...item, sortOrder: index }));
      persist();
      return null;
    }
    if (command === 'reorder_environments') {
      const input = commandArguments(args).input as {
        orderedIds: string[];
        projectId: string;
      };
      const byId = new Map(
        (database.environments[input.projectId] ?? []).map((item) => [
          item.id as string,
          item,
        ]),
      );
      const items = input.orderedIds.map((id, index) => ({
        ...byId.get(id),
        sortOrder: index,
      }));
      database.environments[input.projectId] = items;
      persist();
      return items;
    }
    if (command === 'list_environment_source_candidates') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
        projectId: string;
      };
      return {
        items: [
          {
            id: '7b1cf05b-e89e-485b-846d-0cb0df7d0c19',
            name: '.env',
            relativePath: '.env',
            status: 'active',
          },
        ],
        page: input.page,
        pageSize: input.pageSize,
        totalItems: 1,
        totalPages: 1,
      };
    }
    if (command === 'add_environment_source') {
      const input = commandArguments(args).input as {
        environmentId: string;
        projectId: string;
        relativePath: string;
      };
      const environment = (database.environments[input.projectId] ?? []).find(
        (item) => item.id === input.environmentId,
      );
      if (!environment) throw new Error('Missing environment in E2E mock');
      const sources = environment.sources as Array<Record<string, unknown>>;
      const source = {
        createdAt: '2026-08-04T00:00:00.000Z',
        environmentId: input.environmentId,
        id: crypto.randomUUID(),
        issueCount: 0,
        lastParsedAt: '2026-08-04T00:00:00.000Z',
        modifiedAtMs: 1_775_257_200_000,
        parseStatus: 'parsed',
        priority: sources.length,
        projectId: input.projectId,
        relativePath: input.relativePath,
        sizeBytes: 128,
        status: 'ready',
        updatedAt: '2026-08-04T00:00:00.000Z',
      };
      sources.push(source);
      persist();
      return source;
    }
    if (command === 'remove_environment_source') {
      const input = commandArguments(args).input as {
        projectId: string;
        sourceId: string;
      };
      for (const environment of database.environments[input.projectId] ?? []) {
        const sources = environment.sources as Array<Record<string, unknown>>;
        environment.sources = sources
          .filter((source) => source.id !== input.sourceId)
          .map((source, index) => ({ ...source, priority: index }));
      }
      persist();
      return null;
    }
    if (command === 'reorder_environment_sources') {
      const input = commandArguments(args).input as {
        environmentId: string;
        orderedIds: string[];
        projectId: string;
      };
      const environment = (database.environments[input.projectId] ?? []).find(
        (item) => item.id === input.environmentId,
      );
      if (!environment) throw new Error('Missing environment in E2E mock');
      const byId = new Map(
        (environment.sources as Array<Record<string, unknown>>).map(
          (source) => [source.id as string, source],
        ),
      );
      environment.sources = input.orderedIds.map((id, index) => ({
        ...byId.get(id),
        priority: index,
      }));
      persist();
      return environment.sources;
    }
    if (command === 'get_environment_matrix') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
        projectId: string;
      };
      const columns = (database.environments[input.projectId] ?? []).map(
        (environment) => ({
          environmentId: environment.id,
          name: environment.name,
          sortOrder: environment.sortOrder,
        }),
      );
      return {
        columns,
        page: input.page,
        pageSize: input.pageSize,
        rows: [],
        totalItems: 0,
        totalPages: 0,
      };
    }
    if (
      command === 'refresh_all_environments' ||
      command === 'refresh_environment' ||
      command === 'refresh_environment_source'
    ) {
      return {
        issuesFound: 0,
        keysFound: 0,
        sourcesParsed: 0,
        sourcesRequested: 0,
        sourcesUnavailable: 0,
      };
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
      persist();
      return scan;
    }
    if (command === 'list_assets') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
        projectId: string;
      };
      const discovered = {
        category: 'source',
        extension: 'ts',
        favorite: false,
        id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
        mimeType: 'video/mp2t',
        modifiedAtMs: 1_775_257_200_000,
        name: 'main.ts',
        note: null,
        origin: 'discovered',
        projectId: input.projectId,
        relativePath: 'src/main.ts',
        sizeBytes: 1536,
        status: 'active',
        tags: [],
        updatedAt: '2026-08-02T00:00:00.000Z',
        variantIds: [],
      };
      const items = [
        discovered,
        ...managedAssets.filter((asset) => asset.projectId === input.projectId),
      ];
      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        totalItems: items.length,
        totalPages: 1,
      };
    }
    if (command === 'get_asset') {
      const input = commandArguments(args).input as { assetId: string };
      return managedAssets.find((asset) => asset.id === input.assetId);
    }
    if (command === 'list_asset_variants') {
      const input = commandArguments(args).input as { assetId: string };
      return (variantIdsByAsset.get(input.assetId) ?? []).includes(
        suggestedVariant.id,
      )
        ? [suggestedVariant]
        : [];
    }
    if (command === 'list_asset_variant_candidates') {
      const input = commandArguments(args).input as {
        excludedIds: string[];
        page: number;
        pageSize: number;
      };
      const items = input.excludedIds.includes(suggestedVariant.id)
        ? []
        : [suggestedVariant];
      return {
        assetRoot: 'assets',
        currentFolder: 'assets/branding',
        hasMore: false,
        items,
        page: input.page,
        pageSize: input.pageSize,
        totalItems: items.length,
        totalPages: items.length ? 1 : 0,
      };
    }
    if (command === 'resolve_asset_variant_path') {
      return suggestedVariant;
    }
    if (command === 'update_asset_variants') {
      const input = commandArguments(args).input as {
        assetId: string;
        variantIds: string[];
      };
      variantIdsByAsset.set(input.assetId, input.variantIds);
      const asset = managedAssets.find((item) => item.id === input.assetId);
      if (!asset) throw new Error('Missing managed asset in E2E mock');
      asset.variantIds = input.variantIds;
      persist();
      return asset;
    }
    if (command === 'preview_asset_import') {
      return {
        category: 'image',
        duplicate: null,
        extension: 'png',
        mimeType: 'image/png',
        name: 'logo.png',
        sizeBytes: 2048,
      };
    }
    if (command === 'import_asset') {
      const input = commandArguments(args).input as {
        destination: string;
        favorite: boolean;
        projectId: string;
        tags: string[];
      };
      const asset = {
        category: 'image',
        extension: 'png',
        favorite: input.favorite,
        id: '8b2d755f-6639-448e-a4cf-3c8979820ceb',
        mimeType: 'image/png',
        modifiedAtMs: 1_775_257_200_000,
        name: 'logo.png',
        note: null,
        origin: 'managed',
        projectId: input.projectId,
        relativePath: `${input.destination === '.' ? '' : `${input.destination}/`}logo.png`,
        sizeBytes: 2048,
        status: 'active',
        tags: input.tags,
        updatedAt: '2026-08-02T00:00:00.000Z',
        variantIds: [],
      };
      const existingIndex = managedAssets.findIndex(
        (item) => item.id === asset.id,
      );
      if (existingIndex >= 0) managedAssets[existingIndex] = asset;
      else managedAssets.push(asset);
      persist();
      return { asset, duplicate: null, status: 'imported' };
    }

    throw new Error(`Unhandled E2E command: ${command}`);
  });
}

function loadDatabase(): MockDatabase {
  const empty: MockDatabase = {
    environments: {},
    inventoryScans: {},
    managedAssets: [],
    projects: [],
    settings: {},
    variantIdsByAsset: {},
  };
  const stored = localStorage.getItem(MOCK_DATABASE_KEY);
  if (!stored) return empty;

  try {
    const parsed = JSON.parse(stored) as Partial<MockDatabase>;
    return {
      environments: parsed.environments ?? {},
      inventoryScans: parsed.inventoryScans ?? {},
      managedAssets: parsed.managedAssets ?? [],
      projects: parsed.projects ?? [],
      settings: parsed.settings ?? {},
      variantIdsByAsset: parsed.variantIdsByAsset ?? {},
    };
  } catch {
    localStorage.removeItem(MOCK_DATABASE_KEY);
    return empty;
  }
}

function commandArguments(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error('Invalid E2E command arguments');
  }
  return args as Record<string, unknown>;
}
