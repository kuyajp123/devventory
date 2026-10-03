import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  inventoryPageSchema,
  projectDirectoryPageSchema,
  projectFileContentSchema,
  scanRunSchema,
  type InventoryFilters,
} from '../models/file-inventory';

export const fileInventoryGateway = {
  async list(projectId: string, filters: InventoryFilters) {
    const response = await invokeCommand<unknown>('list_project_files', {
      input: { projectId, ...filters },
    });
    return inventoryPageSchema.parse(response);
  },

  async rescanProject(projectId: string) {
    const response = await invokeCommand<unknown>('rescan_project', {
      projectId,
    });
    return scanRunSchema.parse(response);
  },

  async rescanWatchedLocation(projectId: string, watchedLocationId: string) {
    const response = await invokeCommand<unknown>('rescan_watched_location', {
      projectId,
      watchedLocationId,
    });
    return scanRunSchema.parse(response);
  },

  async listDirectory(
    projectId: string,
    relativePath: string,
    page: number,
    pageSize: number,
  ) {
    const response = await invokeCommand<unknown>('list_project_directory', {
      input: { page, pageSize, projectId, relativePath },
    });
    return projectDirectoryPageSchema.parse(response);
  },

  async readProjectFileContent(projectId: string, fileId: string) {
    const response = await invokeCommand<unknown>('read_project_file_content', {
      input: { fileId, projectId },
    });
    return projectFileContentSchema.parse(response);
  },
};
