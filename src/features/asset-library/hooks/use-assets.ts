import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fileInventoryKeys } from '@/features/file-inventory';
import type {
  AssetFilters,
  ImportAssetInput,
  QuickAction,
  UpdateAssetMetadataInput,
} from '../models/asset';
import { assetLibraryGateway } from '../services/asset-library.gateway';

export const assetKeys = {
  all: ['asset-library'] as const,
  project: (projectId: string) => ['asset-library', projectId] as const,
  list: (projectId: string, filters: AssetFilters) =>
    ['asset-library', projectId, filters] as const,
  detail: (projectId: string, assetId: string) =>
    ['asset-library', projectId, 'detail', assetId] as const,
};

export function useAssetsQuery(projectId: string, filters: AssetFilters) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: assetKeys.list(projectId, filters),
    queryFn: () => assetLibraryGateway.list(projectId, filters),
  });
}

export function useAssetQuery(projectId: string, assetId: string) {
  return useQuery({
    enabled: Boolean(projectId && assetId),
    queryKey: assetKeys.detail(projectId, assetId),
    queryFn: () => assetLibraryGateway.get(projectId, assetId),
  });
}

export function useSelectAssetSourceMutation() {
  return useMutation({ mutationFn: assetLibraryGateway.selectSource });
}

export function usePreviewAssetMutation(projectId: string) {
  return useMutation({
    mutationFn: (sourcePath: string) =>
      assetLibraryGateway.preview(projectId, sourcePath),
  });
}

export function useImportAssetMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ImportAssetInput, 'projectId'>) =>
      assetLibraryGateway.import({ ...input, projectId }),
    onSuccess: async (result) => {
      if (result.asset) {
        queryClient.setQueryData(
          assetKeys.detail(projectId, result.asset.id),
          result.asset,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: assetKeys.project(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: fileInventoryKeys.project(projectId),
        }),
      ]);
    },
  });
}

export function useUpdateAssetMetadataMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateAssetMetadataInput, 'projectId'>) =>
      assetLibraryGateway.updateMetadata({ ...input, projectId }),
    onSuccess: async (asset) => {
      queryClient.setQueryData(assetKeys.detail(projectId, asset.id), asset);
      await queryClient.invalidateQueries({
        queryKey: assetKeys.project(projectId),
      });
    },
  });
}

export function useAssetActionMutation(projectId: string, assetId: string) {
  return useMutation({
    mutationFn: (action: QuickAction) =>
      assetLibraryGateway.runAction(projectId, assetId, action),
  });
}
