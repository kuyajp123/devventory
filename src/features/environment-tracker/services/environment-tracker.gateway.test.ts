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

  it('rejects an IPC source payload that tries to expose a configuration value', async () => {
    mockIPC(() => [sourceResponse({ value: 'not-allowed' })]);

    await expect(
      environmentTrackerGateway.listSources(projectId, environmentId),
    ).rejects.toThrow();
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
