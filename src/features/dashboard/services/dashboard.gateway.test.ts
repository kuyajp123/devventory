import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { dashboardGateway } from './dashboard.gateway';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';

describe('dashboardGateway', () => {
  it('loads and validates the project aggregate DTO', async () => {
    mockIPC((command, payload) => {
      expect(command).toBe('get_project_dashboard');
      expect(payload).toEqual({ projectId });
      return {
        environmentCoverage: [],
        fileCategories: [],
        metrics: {
          environmentKeys: 0,
          environments: 0,
          indexedFiles: 0,
          lastScanAt: null,
          managedAssets: 0,
          missingFiles: 0,
          openValidationIssues: 0,
          watchedLocations: 1,
          watcherStatus: 'unavailable',
        },
        projectId,
        recentScans: [],
        validationSeverities: [],
      };
    });

    await expect(dashboardGateway.get(projectId)).resolves.toMatchObject({
      projectId,
      metrics: { watchedLocations: 1 },
    });
  });
});
