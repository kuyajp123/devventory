import { z } from 'zod';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';

const storedProjectIdSchema = z.string().uuid().nullable();

export const projectSelectionGateway = {
  async getLastOpenedProjectId(): Promise<string | null> {
    const response = await invokeCommand<unknown>('get_last_opened_project_id');
    return storedProjectIdSchema.parse(response);
  },

  async saveLastOpenedProjectId(projectId: string): Promise<void> {
    await invokeCommand<unknown>('save_last_opened_project_id', { projectId });
  },
};
