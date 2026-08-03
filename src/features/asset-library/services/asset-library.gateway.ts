import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  assetPageSchema,
  assetPreviewSchema,
  assetSchema,
  importResultSchema,
  variantCandidatePageSchema,
  variantCandidateSchema,
  type AssetFilters,
  type ImportAssetInput,
  type QuickAction,
  type UpdateAssetMetadataInput,
  type UpdateAssetVariantsInput,
  type VariantCandidateFilters,
} from '../models/asset';

export const assetLibraryGateway = {
  async list(projectId: string, filters: AssetFilters) {
    const response = await invokeCommand<unknown>('list_assets', {
      input: { projectId, ...filters },
    });
    return assetPageSchema.parse(response);
  },

  async get(projectId: string, assetId: string) {
    const response = await invokeCommand<unknown>('get_asset', {
      input: { assetId, projectId },
    });
    return assetSchema.parse(response);
  },

  async selectSource(): Promise<string | null> {
    const selected = await open({
      directory: false,
      multiple: false,
      title: 'Choose a file to import',
    });
    return typeof selected === 'string' ? selected : null;
  },

  async preview(projectId: string, sourcePath: string) {
    const response = await invokeCommand<unknown>('preview_asset_import', {
      input: { projectId, sourcePath },
    });
    return assetPreviewSchema.parse(response);
  },

  async import(input: ImportAssetInput) {
    const response = await invokeCommand<unknown>('import_asset', { input });
    return importResultSchema.parse(response);
  },

  async updateMetadata(input: UpdateAssetMetadataInput) {
    const response = await invokeCommand<unknown>('update_asset_metadata', {
      input,
    });
    return assetSchema.parse(response);
  },

  async listVariantCandidates(
    projectId: string,
    assetId: string,
    filters: VariantCandidateFilters,
  ) {
    const response = await invokeCommand<unknown>(
      'list_asset_variant_candidates',
      { input: { assetId, projectId, ...filters } },
    );
    return variantCandidatePageSchema.parse(response);
  },

  async listVariants(projectId: string, assetId: string) {
    const response = await invokeCommand<unknown>('list_asset_variants', {
      input: { assetId, projectId },
    });
    return variantCandidateSchema.array().parse(response);
  },

  async resolveVariantPath(
    projectId: string,
    assetId: string,
    relativePath: string,
    selectedVariantIds: string[],
  ) {
    const response = await invokeCommand<unknown>(
      'resolve_asset_variant_path',
      {
        input: {
          assetId,
          projectId,
          relativePath,
          selectedVariantIds,
        },
      },
    );
    return variantCandidateSchema.parse(response);
  },

  async updateVariants(input: UpdateAssetVariantsInput) {
    const response = await invokeCommand<unknown>('update_asset_variants', {
      input,
    });
    return assetSchema.parse(response);
  },

  async runAction(projectId: string, assetId: string, action: QuickAction) {
    return invokeCommand<string | null>('run_asset_action', {
      input: { action, assetId, projectId },
    });
  },

  async subscribeToFileDrops(onDrop: (path: string) => void) {
    return getCurrentWindow().onDragDropEvent(({ payload }) => {
      if (payload.type === 'drop' && payload.paths[0]) {
        onDrop(payload.paths[0]);
      }
    });
  },
};
