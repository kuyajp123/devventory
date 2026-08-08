import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { projectDashboardSchema } from '../models/dashboard';

export const dashboardGateway = {
  async get(projectId: string) {
    const response = await invokeCommand<unknown>('get_project_dashboard', {
      projectId,
    });
    return projectDashboardSchema.parse(response);
  },
};
