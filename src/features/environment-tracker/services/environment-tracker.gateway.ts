import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  customEnvironmentKeySchema,
  customEnvironmentSourceSchema,
  environmentMatrixPageSchema,
  environmentSchema,
  environmentSourceCandidatePageSchema,
  environmentSourceSchema,
  type EnvironmentPageFilters,
} from '../models/environment';

export const environmentTrackerGateway = {
  async list(projectId: string) {
    const response = await invokeCommand<unknown>('list_environments', {
      input: { projectId },
    });
    return environmentSchema.array().parse(response);
  },

  async create(input: {
    description?: string;
    name: string;
    projectId: string;
  }) {
    const response = await invokeCommand<unknown>('create_environment', {
      input: {
        name: input.name,
        projectId: input.projectId,
        ...(input.description ? { description: input.description } : {}),
      },
    });
    return environmentSchema.parse(response);
  },

  async update(input: {
    description?: string;
    environmentId: string;
    name: string;
    projectId: string;
  }) {
    const response = await invokeCommand<unknown>('update_environment', {
      input: {
        environmentId: input.environmentId,
        name: input.name,
        projectId: input.projectId,
        ...(input.description ? { description: input.description } : {}),
      },
    });
    return environmentSchema.parse(response);
  },

  delete(projectId: string, environmentId: string) {
    return invokeCommand<void>('delete_environment', {
      input: { environmentId, projectId },
    });
  },

  reorder(projectId: string, environmentIds: string[]) {
    return invokeCommand<void>('reorder_environments', {
      input: { environmentIds, projectId },
    });
  },

  async listSources(projectId: string, environmentId: string) {
    const response = await invokeCommand<unknown>('list_environment_sources', {
      input: { environmentId, projectId },
    });
    return environmentSourceSchema.array().parse(response);
  },

  async addSource(
    projectId: string,
    environmentId: string,
    relativePath: string,
  ) {
    const response = await invokeCommand<unknown>('add_environment_source', {
      input: { environmentId, projectId, relativePath },
    });
    return environmentSourceSchema.parse(response);
  },

  deleteSource(projectId: string, environmentId: string, sourceId: string) {
    return invokeCommand<void>('delete_environment_source', {
      input: { environmentId, projectId, sourceId },
    });
  },

  reorderSources(
    projectId: string,
    environmentId: string,
    sourceIds: string[],
  ) {
    return invokeCommand<void>('reorder_environment_sources', {
      input: { environmentId, projectId, sourceIds },
    });
  },

  async sourceCandidates(projectId: string, filters: EnvironmentPageFilters) {
    const response = await invokeCommand<unknown>(
      'list_environment_source_candidates',
      { input: { projectId, ...filters } },
    );
    return environmentSourceCandidatePageSchema.parse(response);
  },

  async matrix(projectId: string, filters: EnvironmentPageFilters) {
    const response = await invokeCommand<unknown>('get_environment_matrix', {
      input: { projectId, ...filters },
    });
    return environmentMatrixPageSchema.parse(response);
  },

  refreshEnvironment(projectId: string, environmentId: string) {
    return invokeCommand<void>('refresh_environment', {
      input: { environmentId, projectId },
    });
  },

  refreshProject(projectId: string) {
    return invokeCommand<number>('refresh_project_environment_sources', {
      input: { projectId },
    });
  },

  async listCustomSources(projectId: string, environmentId: string) {
    const response = await invokeCommand<unknown>(
      'list_custom_environment_sources',
      { input: { environmentId, projectId } },
    );
    return customEnvironmentSourceSchema.array().parse(response);
  },

  async createCustomSource(input: {
    environmentId: string;
    keyNames: string[];
    name: string;
    projectId: string;
  }) {
    const response = await invokeCommand<unknown>(
      'create_custom_environment_source',
      { input },
    );
    return customEnvironmentSourceSchema.parse(response);
  },

  async renameCustomSource(input: {
    environmentId: string;
    name: string;
    projectId: string;
    sourceId: string;
  }) {
    const response = await invokeCommand<unknown>(
      'rename_custom_environment_source',
      { input },
    );
    return customEnvironmentSourceSchema.parse(response);
  },

  deleteCustomSource(
    projectId: string,
    environmentId: string,
    sourceId: string,
  ) {
    return invokeCommand<void>('delete_custom_environment_source', {
      input: { environmentId, projectId, sourceId },
    });
  },

  async addCustomKey(input: {
    environmentId: string;
    name: string;
    projectId: string;
    sourceId: string;
  }) {
    const response = await invokeCommand<unknown>(
      'add_custom_environment_key',
      {
        input,
      },
    );
    return customEnvironmentKeySchema.parse(response);
  },

  deleteCustomKey(input: {
    environmentId: string;
    keyId: string;
    projectId: string;
    sourceId: string;
  }) {
    return invokeCommand<void>('delete_custom_environment_key', { input });
  },

  async copyCustomKey(input: {
    keyId: string;
    projectId: string;
    targetEnvironmentId: string;
    targetSourceId: string;
  }) {
    const response = await invokeCommand<unknown>(
      'copy_custom_environment_key',
      { input },
    );
    return customEnvironmentKeySchema.parse(response);
  },

  async copyCustomSource(input: {
    projectId: string;
    sourceId: string;
    targetEnvironmentId: string;
    targetName?: string;
  }) {
    const response = await invokeCommand<unknown>(
      'copy_custom_environment_source',
      { input },
    );
    return customEnvironmentSourceSchema.parse(response);
  },
};
