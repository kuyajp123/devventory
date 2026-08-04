import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { environmentTrackerGateway } from './environment-tracker.gateway';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environmentId = 'f00d17bd-2dd6-4b89-a5e7-8517191815a7';

describe('environmentTrackerGateway', () => {
  it('sends project-scoped environment creation through the typed boundary', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('create_environment');
      expect(args).toEqual({
        input: {
          description: 'Local development',
          name: 'Development',
          projectId,
        },
      });
      return environmentFixture();
    });

    await expect(
      environmentTrackerGateway.create(projectId, {
        description: 'Local development',
        name: 'Development',
      }),
    ).resolves.toMatchObject({ name: 'Development', projectId });
  });

  it('uses bounded matrix requests and rejects secret-shaped response fields', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('get_environment_matrix');
      expect(args).toEqual({
        input: { page: 1, pageSize: 50, projectId, search: 'SUPABASE' },
      });
      return {
        columns: [{ environmentId, name: 'Development', sortOrder: 0 }],
        page: 1,
        pageSize: 50,
        rows: [
          {
            cells: [
              {
                duplicateCount: 1,
                environmentId,
                occurrences: [
                  {
                    commented: false,
                    duplicate: false,
                    lineNumber: 1,
                    relativePath: '.env',
                    sourceId: '18a014f7-9032-4625-a93a-73734175f640',
                    sourcePriority: 0,
                    value: 'must-never-cross-the-boundary',
                  },
                ],
                state: 'present',
              },
            ],
            keyDefinitionId: '79bfacff-693d-4b31-9466-5097a34fcfe7',
            keyName: 'SUPABASE_URL',
          },
        ],
        totalItems: 1,
        totalPages: 1,
      };
    });

    const result = await environmentTrackerGateway.matrix(
      projectId,
      'SUPABASE',
      1,
      50,
    );
    expect(result.rows[0]?.cells[0]?.occurrences[0]).not.toHaveProperty(
      'value',
    );
  });

  it('rejects malformed backend matrix metadata', async () => {
    mockIPC(() => ({ columns: [], rows: [{ value: 'secret' }] }));
    await expect(
      environmentTrackerGateway.matrix(projectId, '', 1, 50),
    ).rejects.toThrow();
  });
});

function environmentFixture() {
  return {
    createdAt: '2026-08-04T00:00:00.000Z',
    description: 'Local development',
    id: environmentId,
    name: 'Development',
    projectId,
    sortOrder: 0,
    sources: [],
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}
