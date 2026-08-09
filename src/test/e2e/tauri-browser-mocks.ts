import { mockIPC } from '@tauri-apps/api/mocks';
import type { Project } from '@/features/projects';

const MOCK_DATABASE_KEY = 'devventory.e2e.database';
const LAST_OPENED_PROJECT_KEY = 'workspace.last_opened_project_id';

interface MockDatabase {
  agentAccounts: Array<Record<string, unknown>>;
  environmentSourcesByEnvironment: Record<
    string,
    Array<Record<string, unknown>>
  >;
  environmentsByProject: Record<string, Array<Record<string, unknown>>>;
  inventoryScans: Record<string, Array<Record<string, unknown>>>;
  managedAssets: Array<Record<string, unknown>>;
  projects: Project[];
  searchHistory: Array<Record<string, unknown>>;
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
  const agentAccounts = database.agentAccounts;
  const projects = database.projects;
  const inventoryScans = database.inventoryScans;
  const environmentsByProject = database.environmentsByProject;
  const environmentSourcesByEnvironment =
    database.environmentSourcesByEnvironment;
  const managedAssets = database.managedAssets;
  const validationRulesByProject: Record<
    string,
    Array<Record<string, unknown>>
  > = {};
  const validationIssuesByProject: Record<
    string,
    Array<Record<string, unknown>>
  > = {};
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
    database.environmentsByProject = environmentsByProject;
    database.environmentSourcesByEnvironment = environmentSourcesByEnvironment;
    database.variantIdsByAsset = Object.fromEntries(variantIdsByAsset);
    localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify(database));
  }

  mockIPC((command, args) => {
    if (command === 'health_check') {
      return 'Devventory Rust backend is running';
    }
    if (command === 'list_agent_accounts') {
      return agentAccounts;
    }
    if (command === 'save_agent_account') {
      const input = commandArguments(args).input as {
        customPlatform: string | null;
        defaultTimezone: string;
        id?: string;
        identifier: string;
        platform: string;
        signInMethod: string;
        trackingMode: string;
      };
      const existing = input.id
        ? agentAccounts.find((account) => account.id === input.id)
        : undefined;
      const account = {
        availability: existing?.availability ?? 'unknown',
        createdAt: existing?.createdAt ?? '2026-08-08T00:00:00.000Z',
        customPlatform: input.customPlatform,
        defaultTimezone: input.defaultTimezone,
        id: input.id ?? '76b07ab4-ad48-4fd1-80da-fc3067f0a6cd',
        identifier: input.identifier,
        nextResetAt: existing?.nextResetAt ?? null,
        platform: input.platform,
        quotas: existing?.quotas ?? [],
        signInMethod: input.signInMethod,
        trackingMode: input.trackingMode,
        updatedAt: '2026-08-08T00:00:00.000Z',
      };
      const index = agentAccounts.findIndex((item) => item.id === account.id);
      if (index >= 0) agentAccounts[index] = account;
      else agentAccounts.push(account);
      persist();
      return account;
    }
    if (command === 'delete_agent_account') {
      const input = commandArguments(args).input as { id: string };
      const index = agentAccounts.findIndex(
        (account) => account.id === input.id,
      );
      if (index >= 0) agentAccounts.splice(index, 1);
      persist();
      return null;
    }
    if (command === 'preview_agent_reset') {
      const input = commandArguments(args).input as {
        method: string;
        timezone: string;
      };
      return {
        hadExplicitTimezone: false,
        interpretation: '2026-08-14 15:00 +08',
        method: input.method,
        resetAt: '2026-08-14T07:00:00Z',
        timezone: input.timezone,
      };
    }
    if (command === 'save_agent_quota') {
      const input = commandArguments(args).input as {
        accountId: string;
        id?: string;
        label: string;
        remainingPercent: number | null;
        reminders: Record<string, boolean>;
        resetAt: string;
        timezone: string;
        trackingSource: string;
      };
      const account = agentAccounts.find(
        (candidate) => candidate.id === input.accountId,
      );
      if (!account) throw new Error('Missing mock Agent Usage account');
      const quotas = account.quotas as Array<Record<string, unknown>>;
      const normalizedLabel = input.label.trim().toLocaleLowerCase();
      const hasDuplicateLabel = quotas.some(
        (item) =>
          item.id !== input.id &&
          String(item.label).trim().toLocaleLowerCase() === normalizedLabel,
      );
      if (hasDuplicateLabel) {
        throw {
          code: 'AGENT_USAGE_CONFLICT',
          message: 'untrusted mock backend details',
          recoverable: true,
        };
      }
      const quota = {
        accountId: input.accountId,
        createdAt: '2026-08-08T00:00:00.000Z',
        id: input.id ?? '4f60f8ec-8ad2-431c-b3d3-adc63effc438',
        label: input.label,
        remainingPercent: input.remainingPercent,
        reminders: input.reminders,
        resetAt: input.resetAt,
        resetReachedAt: null,
        resetTiming: 'future',
        status: input.remainingPercent === 0 ? 'exhausted' : 'unknown',
        timezone: input.timezone,
        trackingSource: input.trackingSource,
        updatedAt: '2026-08-08T00:00:00.000Z',
        usageIsStale: false,
        usageUpdatedAt:
          input.remainingPercent == null ? null : '2026-08-08T00:00:00.000Z',
      };
      const quotaIndex = quotas.findIndex((item) => item.id === quota.id);
      if (quotaIndex >= 0) quotas[quotaIndex] = quota;
      else quotas.push(quota);
      account.nextResetAt = input.resetAt;
      account.availability = quota.status;
      persist();
      return quota;
    }
    if (command === 'delete_agent_quota') {
      const input = commandArguments(args).input as {
        accountId: string;
        quotaId: string;
      };
      const account = agentAccounts.find(
        (candidate) => candidate.id === input.accountId,
      );
      if (account) {
        account.quotas = (
          account.quotas as Array<Record<string, unknown>>
        ).filter((quota) => quota.id !== input.quotaId);
      }
      persist();
      return null;
    }
    if (command === 'take_due_agent_reminders') {
      return [];
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
    if (command === 'delete_project') {
      const projectId = commandArguments(args).projectId as string;
      const index = projects.findIndex((project) => project.id === projectId);
      if (index >= 0) projects.splice(index, 1);
      delete inventoryScans[projectId];
      delete environmentsByProject[projectId];
      database.managedAssets = managedAssets.filter(
        (asset) => asset.projectId !== projectId,
      );
      database.searchHistory = database.searchHistory.filter(
        (entry) => entry.projectId !== projectId,
      );
      persist();
      return null;
    }
    if (command === 'search_metadata') {
      const request = commandArguments(args).request as {
        page: number;
        pageSize: number;
        projectId: string | null;
        query: string;
      };
      const normalizedQuery = request.query.trim().toLowerCase();
      const candidates = projects
        .filter(
          (project) => !request.projectId || project.id === request.projectId,
        )
        .flatMap((project) => [
          {
            category: 'source',
            extension: 'ts',
            id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
            modifiedAtMs: 1_775_257_200_000,
            name: 'main.ts',
            note: null,
            origin: 'discovered',
            projectId: project.id,
            projectName: project.name,
            relativePath: 'src/main.ts',
            resultType: 'file',
            status: 'active',
            tags: [],
          },
        ])
        .filter(
          (item) =>
            !normalizedQuery ||
            item.name.toLowerCase().includes(normalizedQuery) ||
            item.relativePath.toLowerCase().includes(normalizedQuery),
        );
      const offset = (request.page - 1) * request.pageSize;
      return {
        hasMore: offset + request.pageSize < candidates.length,
        items: candidates.slice(offset, offset + request.pageSize),
        page: request.page,
        pageSize: request.pageSize,
        totalItems: candidates.length,
        totalPages: Math.ceil(candidates.length / request.pageSize),
      };
    }
    if (command === 'record_search_history') {
      const request = commandArguments(args).request as Record<string, unknown>;
      if (!String(request.query ?? '').trim()) return null;
      const requestJson = JSON.stringify(request);
      database.searchHistory = database.searchHistory.filter(
        (entry) => JSON.stringify(entry.request) !== requestJson,
      );
      const entry = {
        createdAt: '2026-08-09T00:00:00.000Z',
        id: '8162f1bc-009c-4c40-8ebd-303682446e6e',
        projectId: request.projectId ?? null,
        request,
      };
      database.searchHistory.unshift(entry);
      database.searchHistory.splice(20);
      persist();
      return entry;
    }
    if (command === 'list_search_history') {
      return database.searchHistory.map((entry) => ({
        createdAt: entry.createdAt,
        id: entry.id,
        request: entry.request,
      }));
    }
    if (command === 'delete_search_history') {
      const historyId = commandArguments(args).historyId as string;
      database.searchHistory = database.searchHistory.filter(
        (entry) => entry.id !== historyId,
      );
      persist();
      return null;
    }
    if (command === 'clear_search_history') {
      database.searchHistory = [];
      persist();
      return null;
    }
    if (command === 'get_project_dashboard') {
      const projectId = commandArguments(args).projectId as string;
      if (!projects.some((project) => project.id === projectId)) {
        throw new Error('Missing mock dashboard project');
      }
      const environments = environmentsByProject[projectId] ?? [];
      const issues = validationIssuesByProject[projectId] ?? [];
      const scans = inventoryScans[projectId] ?? [];
      const assets = managedAssets.filter(
        (asset) => asset.projectId === projectId,
      );
      return {
        environmentCoverage: environments.map((environment) => ({
          coveragePercent: 100,
          environmentId: environment.id,
          knownKeys: 1,
          name: environment.name,
          presentKeys: 1,
          unavailableSources: 0,
        })),
        fileCategories: [{ category: 'source', count: 1 }],
        metrics: {
          environmentKeys: environments.length ? 1 : 0,
          environments: environments.length,
          indexedFiles: 1 + assets.length,
          lastScanAt: (scans[0]?.startedAt as string | undefined) ?? null,
          managedAssets: assets.length,
          missingFiles: 0,
          openValidationIssues: issues.filter(
            (issue) => issue.status === 'open',
          ).length,
          watchedLocations: 1,
          watcherStatus: 'unavailable',
        },
        projectId,
        recentScans: scans.slice(0, 8),
        validationSeverities: issues.some((issue) => issue.status === 'open')
          ? [{ count: 1, severity: 'error' }]
          : [],
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
    if (command === 'list_environments') {
      const projectId = commandArguments(args).input as { projectId: string };
      return environmentsByProject[projectId.projectId] ?? [];
    }
    if (command === 'create_environment') {
      const input = commandArguments(args).input as {
        description?: string;
        name: string;
        projectId: string;
      };
      const environments = environmentsByProject[input.projectId] ?? [];
      const environment = environmentResponse(input, environments.length);
      environments.push(environment);
      environmentsByProject[input.projectId] = environments;
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
      const environments = environmentsByProject[input.projectId] ?? [];
      const index = environments.findIndex(
        (environment) => environment.id === input.environmentId,
      );
      if (index < 0) throw new Error('Missing mock environment');
      const environment = {
        ...environments[index],
        description: input.description ?? null,
        name: input.name,
        updatedAt: '2026-08-05T00:00:00.000Z',
      };
      environments[index] = environment;
      persist();
      return environment;
    }
    if (command === 'delete_environment') {
      const input = commandArguments(args).input as {
        environmentId: string;
        projectId: string;
      };
      environmentsByProject[input.projectId] = (
        environmentsByProject[input.projectId] ?? []
      ).filter((environment) => environment.id !== input.environmentId);
      delete environmentSourcesByEnvironment[input.environmentId];
      persist();
      return null;
    }
    if (command === 'reorder_environments') {
      const input = commandArguments(args).input as {
        environmentIds: string[];
        projectId: string;
      };
      const existing = environmentsByProject[input.projectId] ?? [];
      environmentsByProject[input.projectId] = input.environmentIds.map(
        (id, sortOrder) => ({
          ...existing.find((environment) => environment.id === id),
          sortOrder,
        }),
      );
      persist();
      return null;
    }
    if (command === 'list_environment_sources') {
      const input = commandArguments(args).input as { environmentId: string };
      return environmentSourcesByEnvironment[input.environmentId] ?? [];
    }
    if (command === 'add_environment_source') {
      const input = commandArguments(args).input as {
        environmentId: string;
        projectId: string;
        relativePath: string;
      };
      const sources =
        environmentSourcesByEnvironment[input.environmentId] ?? [];
      const source = environmentSourceResponse(input, sources.length);
      sources.push(source);
      environmentSourcesByEnvironment[input.environmentId] = sources;
      persist();
      return source;
    }
    if (command === 'delete_environment_source') {
      const input = commandArguments(args).input as {
        environmentId: string;
        sourceId: string;
      };
      environmentSourcesByEnvironment[input.environmentId] = (
        environmentSourcesByEnvironment[input.environmentId] ?? []
      ).filter((source) => source.id !== input.sourceId);
      persist();
      return null;
    }
    if (command === 'reorder_environment_sources') {
      const input = commandArguments(args).input as {
        environmentId: string;
        sourceIds: string[];
      };
      const existing =
        environmentSourcesByEnvironment[input.environmentId] ?? [];
      environmentSourcesByEnvironment[input.environmentId] =
        input.sourceIds.map((id, sortOrder) => ({
          ...existing.find((source) => source.id === id),
          sortOrder,
        }));
      persist();
      return null;
    }
    if (command === 'list_environment_source_candidates') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
      };
      return {
        items: [
          {
            extension: 'env',
            name: 'local.env',
            relativePath: 'config/local.env',
          },
        ],
        page: input.page,
        pageSize: input.pageSize,
        totalItems: 1,
        totalPages: 1,
      };
    }
    if (command === 'get_environment_matrix') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
        projectId: string;
      };
      const environments = environmentsByProject[input.projectId] ?? [];
      return {
        environments,
        page: input.page,
        pageSize: input.pageSize,
        rows:
          environments.length === 0
            ? []
            : [
                {
                  cells: environments.map((environment) => {
                    const source = (environmentSourcesByEnvironment[
                      environment.id as string
                    ] ?? [])[0] as Record<string, unknown> | undefined;
                    return source
                      ? {
                          sourceDetails: [
                            {
                              isCommented: false,
                              lineNumber: 1,
                              relativePath: source.relativePath,
                            },
                          ],
                          state: 'present',
                        }
                      : { sourceDetails: [], state: 'absent' };
                  }),
                  keyName: 'APP_MODE',
                },
              ],
        totalItems: environments.length === 0 ? 0 : 1,
        totalPages: environments.length === 0 ? 0 : 1,
      };
    }
    if (
      command === 'refresh_environment' ||
      command === 'refresh_project_environment_sources'
    ) {
      return command === 'refresh_project_environment_sources' ? 1 : null;
    }
    if (command === 'list_validation_rules') {
      const input = commandArguments(args).input as { projectId: string };
      return validationRulesByProject[input.projectId] ?? [];
    }
    if (command === 'save_validation_rule') {
      const input = commandArguments(args).input as {
        description?: string;
        enabled: boolean;
        environmentIds: string[];
        keyName: string;
        projectId: string;
        ruleId?: string;
        ruleType: string;
        severity: string;
      };
      const rules = validationRulesByProject[input.projectId] ?? [];
      const rule = {
        createdAt: '2026-08-08T00:00:00.000Z',
        description: input.description || null,
        enabled: input.enabled,
        environmentIds: input.environmentIds,
        id: input.ruleId ?? 'c4373b86-1c32-4f96-a315-f5d17089966f',
        keyName: input.keyName,
        projectId: input.projectId,
        ruleType: input.ruleType,
        severity: input.severity,
        sortOrder: Math.max(0, rules.length),
        updatedAt: '2026-08-08T00:00:00.000Z',
      };
      const existing = rules.findIndex((item) => item.id === rule.id);
      if (existing >= 0) rules[existing] = rule;
      else rules.push(rule);
      validationRulesByProject[input.projectId] = rules;
      validationIssuesByProject[input.projectId] = [
        validationIssueResponse(
          input.projectId,
          input.environmentIds[0] as string,
        ),
      ];
      return rule;
    }
    if (command === 'delete_validation_rule') {
      const input = commandArguments(args).input as {
        projectId: string;
        ruleId: string;
      };
      validationRulesByProject[input.projectId] = (
        validationRulesByProject[input.projectId] ?? []
      ).filter((rule) => rule.id !== input.ruleId);
      return null;
    }
    if (command === 'reorder_validation_rules') {
      const input = commandArguments(args).input as {
        projectId: string;
        ruleIds: string[];
      };
      const rules = validationRulesByProject[input.projectId] ?? [];
      validationRulesByProject[input.projectId] = input.ruleIds.map(
        (id, sortOrder) => ({
          ...rules.find((rule) => rule.id === id),
          sortOrder,
        }),
      );
      return null;
    }
    if (command === 'list_validation_issues') {
      const input = commandArguments(args).input as {
        page: number;
        pageSize: number;
        projectId: string;
        status?: string;
      };
      const items = (validationIssuesByProject[input.projectId] ?? []).filter(
        (issue) => !input.status || issue.status === input.status,
      );
      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        totalItems: items.length,
        totalPages: items.length ? 1 : 0,
      };
    }
    if (command === 'get_validation_summary') {
      const input = commandArguments(args).input as { projectId: string };
      const issues = validationIssuesByProject[input.projectId] ?? [];
      const open = issues.filter((issue) => issue.status === 'open');
      return {
        errorIssues: open.filter((issue) => issue.severity === 'error').length,
        health: open.length ? 'error' : 'healthy',
        ignoredIssues: issues.filter((issue) => issue.status === 'ignored')
          .length,
        infoIssues: 0,
        lastSuccessfulAt: '2026-08-08T00:00:00.000Z',
        openIssues: open.length,
        resolvedIssues: 0,
        warningIssues: 0,
      };
    }
    if (command === 'run_project_validation') {
      const input = commandArguments(args).input as { projectId: string };
      const issues = validationIssuesByProject[input.projectId] ?? [];
      return {
        issuesDetected: issues.length,
        issuesResolved: 0,
        summary: {
          errorIssues: issues.filter((issue) => issue.status === 'open').length,
          health: issues.some((issue) => issue.status === 'open')
            ? 'error'
            : 'healthy',
          ignoredIssues: issues.filter((issue) => issue.status === 'ignored')
            .length,
          infoIssues: 0,
          lastSuccessfulAt: '2026-08-08T00:00:00.000Z',
          openIssues: issues.filter((issue) => issue.status === 'open').length,
          resolvedIssues: 0,
          warningIssues: 0,
        },
      };
    }
    if (command === 'set_validation_issue_status') {
      const input = commandArguments(args).input as {
        issueId: string;
        projectId: string;
        status: string;
      };
      const issue = (validationIssuesByProject[input.projectId] ?? []).find(
        (item) => item.id === input.issueId,
      );
      if (!issue) throw new Error('Missing mock validation issue');
      issue.status = input.status;
      return issue;
    }
    if (command === 'preview_environment_manifest') {
      const input = commandArguments(args).input as {
        projectId: string;
        relativePath: string;
      };
      const keys = (validationRulesByProject[input.projectId] ?? [])
        .map((rule) => rule.keyName as string)
        .sort();
      return {
        content: keys.map((key) => `${key}=\n`).join(''),
        exists: false,
        keyCount: keys.length,
        relativePath: input.relativePath,
      };
    }
    if (command === 'export_environment_manifest') {
      const input = commandArguments(args).input as {
        projectId: string;
        relativePath: string;
      };
      return {
        keyCount: (validationRulesByProject[input.projectId] ?? []).length,
        relativePath: input.relativePath,
        replaced: false,
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
    agentAccounts: [],
    environmentSourcesByEnvironment: {},
    environmentsByProject: {},
    inventoryScans: {},
    managedAssets: [],
    projects: [],
    searchHistory: [],
    settings: {},
    variantIdsByAsset: {},
  };
  const stored = localStorage.getItem(MOCK_DATABASE_KEY);
  if (!stored) return empty;

  try {
    const parsed = JSON.parse(stored) as Partial<MockDatabase>;
    return {
      agentAccounts: parsed.agentAccounts ?? [],
      inventoryScans: parsed.inventoryScans ?? {},
      environmentSourcesByEnvironment:
        parsed.environmentSourcesByEnvironment ?? {},
      environmentsByProject: parsed.environmentsByProject ?? {},
      managedAssets: parsed.managedAssets ?? [],
      projects: parsed.projects ?? [],
      searchHistory: parsed.searchHistory ?? [],
      settings: parsed.settings ?? {},
      variantIdsByAsset: parsed.variantIdsByAsset ?? {},
    };
  } catch {
    localStorage.removeItem(MOCK_DATABASE_KEY);
    return empty;
  }
}

function environmentResponse(
  input: { description?: string; name: string; projectId: string },
  sortOrder: number,
) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    description: input.description ?? null,
    id: `d63f9ad6-0817-4b8b-ad88-ec19881295${sortOrder.toString().padStart(2, '0')}`,
    name: input.name,
    projectId: input.projectId,
    sortOrder,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function environmentSourceResponse(
  input: { environmentId: string; projectId: string; relativePath: string },
  sortOrder: number,
) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId: input.environmentId,
    id: `f5443f4c-f04c-4ccf-850b-fbe53d24fc${sortOrder.toString().padStart(2, '0')}`,
    lastIssueCode: null,
    lastIssueLine: null,
    lastIssueMessage: null,
    lastObservedModifiedAtMs: 1_775_257_200_000,
    lastObservedSizeBytes: 42,
    lastParsedAt: '2026-08-05T00:00:00.000Z',
    lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
    parseStatus: 'parsed',
    projectId: input.projectId,
    relativePath: input.relativePath,
    sortOrder,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function validationIssueResponse(projectId: string, environmentId: string) {
  return {
    environmentId,
    environmentName: 'Development',
    firstSeenAt: '2026-08-08T00:00:00.000Z',
    id: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
    issueType: 'required_missing',
    keyName: 'DATABASE_URL',
    lastSeenAt: '2026-08-08T00:00:00.000Z',
    lineNumber: null,
    message: "Required key 'DATABASE_URL' is missing.",
    observedName: null,
    projectId,
    resolvedAt: null,
    ruleId: 'c4373b86-1c32-4f96-a315-f5d17089966f',
    severity: 'error',
    sourcePath: null,
    status: 'open',
    updatedAt: '2026-08-08T00:00:00.000Z',
  };
}

function commandArguments(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error('Invalid E2E command arguments');
  }
  return args as Record<string, unknown>;
}
