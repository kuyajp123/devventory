import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  initialScanSummarySchema,
  projectSchema,
  projectsSchema,
  validatedProjectRootSchema,
  type CreateProjectInput,
  type ProjectConfigurationInput,
} from '../models/project';

export const projectsGateway = {
  async validateRoot(rootPath: string) {
    const response = await invokeCommand<unknown>('validate_project_root', {
      input: { rootPath },
    });
    return validatedProjectRootSchema.parse(response);
  },

  async scan(input: ProjectConfigurationInput) {
    const response = await invokeCommand<unknown>('scan_project_root', {
      input,
    });
    return initialScanSummarySchema.parse(response);
  },

  async create(input: CreateProjectInput) {
    const response = await invokeCommand<unknown>('create_project', { input });
    return projectSchema.parse(response);
  },

  async list() {
    const response = await invokeCommand<unknown>('list_projects');
    return projectsSchema.parse(response);
  },

  async get(projectId: string) {
    const response = await invokeCommand<unknown>('get_project', { projectId });
    return projectSchema.parse(response);
  },

  async delete(projectId: string) {
    await invokeCommand<void>('delete_project', { projectId });
  },
};
