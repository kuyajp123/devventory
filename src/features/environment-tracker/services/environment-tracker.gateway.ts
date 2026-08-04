import { z } from 'zod';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  environmentMatrixPageSchema,
  environmentSourceSchema,
  projectEnvironmentSchema,
  refreshSummarySchema,
  sourceCandidatePageSchema,
  type EnvironmentFormValues,
} from '../models/environment-tracker';

const environmentListSchema = z.array(projectEnvironmentSchema);
const sourceListSchema = z.array(environmentSourceSchema);

export const environmentTrackerGateway = {
  async list(projectId: string) {
    const response = await invokeCommand<unknown>('list_environments', {
      input: { projectId },
    });
    return environmentListSchema.parse(response);
  },

  async create(projectId: string, values: EnvironmentFormValues) {
    const response = await invokeCommand<unknown>('create_environment', {
      input: { projectId, ...values },
    });
    return projectEnvironmentSchema.parse(response);
  },

  async update(
    projectId: string,
    environmentId: string,
    values: EnvironmentFormValues,
  ) {
    const response = await invokeCommand<unknown>('update_environment', {
      input: { projectId, environmentId, ...values },
    });
    return projectEnvironmentSchema.parse(response);
  },

  async remove(projectId: string, environmentId: string) {
    await invokeCommand<unknown>('delete_environment', {
      input: { projectId, environmentId },
    });
  },

  async reorder(projectId: string, orderedIds: string[]) {
    const response = await invokeCommand<unknown>('reorder_environments', {
      input: { projectId, orderedIds },
    });
    return environmentListSchema.parse(response);
  },

  async sourceCandidates(
    projectId: string,
    search: string,
    page: number,
    pageSize: number,
  ) {
    const response = await invokeCommand<unknown>(
      'list_environment_source_candidates',
      { input: { projectId, search, page, pageSize } },
    );
    return sourceCandidatePageSchema.parse(response);
  },

  async addSource(
    projectId: string,
    environmentId: string,
    relativePath: string,
  ) {
    const response = await invokeCommand<unknown>('add_environment_source', {
      input: { projectId, environmentId, relativePath },
    });
    return environmentSourceSchema.parse(response);
  },

  async removeSource(projectId: string, sourceId: string) {
    await invokeCommand<unknown>('remove_environment_source', {
      input: { projectId, sourceId },
    });
  },

  async reorderSources(
    projectId: string,
    environmentId: string,
    orderedIds: string[],
  ) {
    const response = await invokeCommand<unknown>(
      'reorder_environment_sources',
      { input: { projectId, environmentId, orderedIds } },
    );
    return sourceListSchema.parse(response);
  },

  async refreshSource(projectId: string, sourceId: string) {
    const response = await invokeCommand<unknown>(
      'refresh_environment_source',
      {
        input: { projectId, sourceId },
      },
    );
    return refreshSummarySchema.parse(response);
  },

  async refreshEnvironment(projectId: string, environmentId: string) {
    const response = await invokeCommand<unknown>('refresh_environment', {
      input: { projectId, environmentId },
    });
    return refreshSummarySchema.parse(response);
  },

  async refreshAll(projectId: string) {
    const response = await invokeCommand<unknown>('refresh_all_environments', {
      input: { projectId },
    });
    return refreshSummarySchema.parse(response);
  },

  async matrix(
    projectId: string,
    search: string,
    page: number,
    pageSize: number,
  ) {
    const response = await invokeCommand<unknown>('get_environment_matrix', {
      input: { projectId, search, page, pageSize },
    });
    return environmentMatrixPageSchema.parse(response);
  },
};
