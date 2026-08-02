import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { fileInventoryGateway } from './file-inventory.gateway';

describe('fileInventoryGateway', () => {
  it('sends bounded filters through the typed command boundary', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    mockIPC((command, args) => {
      expect(command).toBe('list_project_files');
      expect(args).toEqual({
        input: {
          category: 'source',
          page: 1,
          pageSize: 50,
          projectId,
          search: 'main',
          sortBy: 'relativePath',
          sortDirection: 'ascending',
        },
      });
      return {
        items: [],
        page: 1,
        pageSize: 50,
        recentScans: [],
        totalItems: 0,
        totalPages: 0,
        watchedLocations: [],
      };
    });

    await expect(
      fileInventoryGateway.list(projectId, {
        category: 'source',
        page: 1,
        pageSize: 50,
        search: 'main',
        sortBy: 'relativePath',
        sortDirection: 'ascending',
      }),
    ).resolves.toMatchObject({ totalItems: 0 });
  });

  it('rejects malformed backend metadata', async () => {
    mockIPC(() => ({ items: [{ relativePath: '../escape' }] }));
    await expect(
      fileInventoryGateway.list('30af17bd-2dd6-4b89-a5e7-8517191815a7', {
        page: 1,
        pageSize: 50,
        sortBy: 'relativePath',
        sortDirection: 'ascending',
      }),
    ).rejects.toThrow();
  });
});
