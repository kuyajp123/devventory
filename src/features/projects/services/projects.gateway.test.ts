import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { projectsGateway } from './projects.gateway';

describe('projectsGateway', () => {
  it('sends a typed scan configuration through the feature command boundary', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('scan_project_root');
      expect(args).toEqual({
        input: {
          exclusions: ['node_modules/'],
          rootPath: 'C:\\workspace\\devventory',
          watchedLocations: ['.'],
        },
      });
      return {
        completed: true,
        directoriesVisited: 3,
        durationMs: 12,
        entriesExcluded: 1,
        entriesUnreadable: 0,
        filesDiscovered: 7,
      };
    });

    await expect(
      projectsGateway.scan({
        exclusions: ['node_modules/'],
        rootPath: 'C:\\workspace\\devventory',
        watchedLocations: ['.'],
      }),
    ).resolves.toMatchObject({ filesDiscovered: 7, completed: true });
  });

  it('rejects malformed command responses at the gateway', async () => {
    mockIPC(() => ({ id: 'not-a-project' }));

    await expect(projectsGateway.list()).rejects.toThrow();
  });

  it('deletes only the requested project registration', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('delete_project');
      expect(args).toEqual({
        projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      });
    });

    await expect(
      projectsGateway.delete('30af17bd-2dd6-4b89-a5e7-8517191815a7'),
    ).resolves.toBeUndefined();
  });
});
