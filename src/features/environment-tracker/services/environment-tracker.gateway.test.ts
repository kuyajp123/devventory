import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { environmentTrackerGateway } from './environment-tracker.gateway';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';

describe('environmentTrackerGateway', () => {
  it('requests a bounded server-paginated inventory source search', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('list_environment_source_candidates');
      expect(args).toEqual({
        input: { page: 2, pageSize: 25, projectId, search: 'config' },
      });
      return {
        items: [],
        page: 2,
        pageSize: 25,
        totalItems: 143,
        totalPages: 6,
      };
    });

    await expect(
      environmentTrackerGateway.sourceCandidates(projectId, {
        page: 2,
        pageSize: 25,
        search: 'config',
      }),
    ).resolves.toMatchObject({ totalItems: 143, totalPages: 6 });
  });

  it('sends project-scoped source ordering only when requested', async () => {
    const sourceIds = [
      'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
      'b3e91b34-6629-4ff4-b92a-b3c65d7b1093',
    ];
    mockIPC((command, args) => {
      expect(command).toBe('reorder_environment_sources');
      expect(args).toEqual({ input: { environmentId, projectId, sourceIds } });
      return null;
    });

    await expect(
      environmentTrackerGateway.reorderSources(
        projectId,
        environmentId,
        sourceIds,
      ),
    ).resolves.toBeNull();
  });

  it('requests one paginated environment projection and validates its cell metadata', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('get_environment_matrix');
      expect(args).toEqual({
        input: {
          environmentId,
          page: 2,
          pageSize: 25,
          projectId,
          search: 'DATABASE',
        },
      });
      return {
        environments: [environmentResponse()],
        page: 2,
        pageSize: 25,
        rows: [
          {
            cells: [
              {
                sourceDetails: [],
                state: 'absent',
                validation: {
                  openIssues: [validationIssueResponse()],
                  rules: [validationRuleResponse()],
                },
              },
            ],
            keyName: 'DATABASE_URL',
          },
        ],
        totalItems: 26,
        totalPages: 2,
      };
    });

    await expect(
      environmentTrackerGateway.matrix(projectId, {
        environmentId,
        page: 2,
        pageSize: 25,
        search: 'DATABASE',
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          cells: [
            {
              state: 'absent',
              validation: {
                openIssues: [{ severity: 'error', status: 'open' }],
                rules: [{ keyName: 'DATABASE_URL', ruleType: 'required' }],
              },
            },
          ],
        },
      ],
      totalItems: 26,
    });
  });

  it('rejects an IPC source payload that tries to expose a configuration value', async () => {
    mockIPC(() => [sourceResponse({ value: 'not-allowed' })]);

    await expect(
      environmentTrackerGateway.listSources(projectId, environmentId),
    ).rejects.toThrow();
  });

  it('creates metadata-only custom sources and validates their keys', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('create_custom_environment_source');
      expect(args).toEqual({
        input: {
          environmentId,
          keyNames: ['devventory-firebase-adminsdk.json'],
          name: 'Firebase Credentials',
          projectId,
        },
      });
      return customSourceResponse();
    });

    await expect(
      environmentTrackerGateway.createCustomSource({
        environmentId,
        keyNames: ['devventory-firebase-adminsdk.json'],
        name: 'Firebase Credentials',
        projectId,
      }),
    ).resolves.toMatchObject({
      keys: [{ name: 'devventory-firebase-adminsdk.json' }],
      name: 'Firebase Credentials',
    });
  });

  it('copies a custom key to an explicitly selected target source', async () => {
    const keyId = '78657c9e-3bdf-4bd2-a38c-ff9e24096875';
    const targetSourceId = '26a169cf-6ccc-45ce-94e4-2982343c6317';
    mockIPC((command, args) => {
      expect(command).toBe('copy_custom_environment_key');
      expect(args).toEqual({
        input: {
          keyId,
          projectId,
          targetEnvironmentId: environmentId,
          targetSourceId,
        },
      });
      return customKeyResponse({ id: keyId, sourceId: targetSourceId });
    });

    await expect(
      environmentTrackerGateway.copyCustomKey({
        keyId,
        projectId,
        targetEnvironmentId: environmentId,
        targetSourceId,
      }),
    ).resolves.toMatchObject({ sourceId: targetSourceId });
  });
});

function sourceResponse(extra: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId,
    id: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
    lastIssueCode: null,
    lastIssueLine: null,
    lastIssueMessage: null,
    lastObservedModifiedAtMs: 1_775_257_200_000,
    lastObservedSizeBytes: 42,
    lastParsedAt: '2026-08-05T00:00:00.000Z',
    lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
    parseStatus: 'parsed',
    projectId,
    relativePath: 'config/local.env',
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
    ...extra,
  };
}

function environmentResponse() {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    description: null,
    id: environmentId,
    name: 'Production',
    projectId,
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function customKeyResponse(extra: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId,
    id: '78657c9e-3bdf-4bd2-a38c-ff9e24096875',
    name: 'devventory-firebase-adminsdk.json',
    normalizedName: 'DEVVENTORY-FIREBASE-ADMINSDK.JSON',
    projectId,
    sourceId: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
    updatedAt: '2026-08-05T00:00:00.000Z',
    ...extra,
  };
}

function customSourceResponse() {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId,
    id: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
    keys: [customKeyResponse()],
    name: 'Firebase Credentials',
    projectId,
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function validationRuleResponse() {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    description: 'Production database connection',
    enabled: true,
    environmentIds: [environmentId],
    id: '6ce45b9b-83fe-48f1-a744-17739bfbd7fd',
    keyName: 'DATABASE_URL',
    projectId,
    ruleType: 'required',
    severity: 'error',
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function validationIssueResponse() {
  return {
    environmentId,
    environmentName: 'Production',
    firstSeenAt: '2026-08-05T00:00:00.000Z',
    id: '4ce13759-a72a-4595-8133-2d7100f42f01',
    issueType: 'required_missing',
    keyName: 'DATABASE_URL',
    lastSeenAt: '2026-08-05T00:00:00.000Z',
    lineNumber: null,
    message: 'Required key is missing.',
    observedName: null,
    projectId,
    resolvedAt: null,
    ruleId: validationRuleResponse().id,
    severity: 'error',
    sourcePath: null,
    status: 'open',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}
