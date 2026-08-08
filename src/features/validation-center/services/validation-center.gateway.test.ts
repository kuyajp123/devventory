import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { validationCenterGateway } from './validation-center.gateway';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';

describe('validationCenterGateway', () => {
  it('sends bounded project-scoped issue filters to the backend', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('list_validation_issues');
      expect(args).toEqual({
        input: {
          descending: true,
          page: 2,
          pageSize: 25,
          projectId,
          ruleType: 'required',
          search: 'DATABASE',
          sort: 'severity',
          status: 'open',
        },
      });
      return {
        items: [],
        page: 2,
        pageSize: 25,
        totalItems: 120,
        totalPages: 5,
      };
    });

    await expect(
      validationCenterGateway.listIssues(projectId, {
        descending: true,
        page: 2,
        pageSize: 25,
        ruleType: 'required',
        search: 'DATABASE',
        sort: 'severity',
        status: 'open',
      }),
    ).resolves.toMatchObject({ totalItems: 120, totalPages: 5 });
  });

  it('rejects issue payloads containing an environment value', async () => {
    mockIPC(() => ({
      items: [issueResponse({ value: 'not-allowed' })],
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    }));

    await expect(
      validationCenterGateway.listIssues(projectId, {
        descending: true,
        page: 1,
        pageSize: 25,
        sort: 'updated_at',
      }),
    ).rejects.toThrow();
  });

  it('exports only after an explicit collision choice', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('export_environment_manifest');
      expect(args).toEqual({
        input: {
          collisionChoice: 'replace',
          projectId,
          relativePath: 'config/.env.example',
        },
      });
      return {
        keyCount: 12,
        relativePath: 'config/.env.example',
        replaced: true,
      };
    });

    await expect(
      validationCenterGateway.exportManifest(
        projectId,
        'config/.env.example',
        'replace',
      ),
    ).resolves.toMatchObject({ keyCount: 12, replaced: true });
  });
});

function issueResponse(extra: Record<string, unknown> = {}) {
  return {
    environmentId: null,
    environmentName: null,
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
    ruleId: null,
    severity: 'error',
    sourcePath: null,
    status: 'open',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...extra,
  };
}
