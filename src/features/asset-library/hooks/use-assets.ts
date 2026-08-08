import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fileInventoryKeys } from '@/features/file-inventory';
import { invalidateDerivedProjectQueries } from '@/shared/query/derived-query-keys';
import type {
  AssetFilters,
  ImportAssetInput,
  QuickAction,
  UpdateAssetMetadataInput,
  UpdateAssetVariantsInput,
  VariantCandidateFilters,
} from '../models/asset';
import { assetLibraryGateway } from '../services/asset-library.gateway';

export const assetKeys = {
  all: ['asset-library'] as const,
  project: (projectId: string) => ['asset-library', projectId] as const,
  list: (projectId: string, filters: AssetFilters) =>
    ['asset-library', projectId, filters] as const,
  detail: (projectId: string, assetId: string) =>
    ['asset-library', projectId, 'detail', assetId] as const,
  variants: (projectId: string, assetId: string) =>
    ['asset-library', projectId, 'detail', assetId, 'variants'] as const,
  variantCandidates: (
    projectId: string,
    assetId: string,
    filters: VariantCandidateFilters,
  ) =>
    [
      'asset-library',
      projectId,
      'detail',
      assetId,
      'variant-candidates',
      filters,
    ] as const,
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

export function useAssetVariantsQuery(projectId: string, assetId: string) {
  return useQuery({
    enabled: Boolean(projectId && assetId),
    queryKey: assetKeys.variants(projectId, assetId),
    queryFn: () => assetLibraryGateway.listVariants(projectId, assetId),
  });
}

export function useVariantCandidatesQuery(
  projectId: string,
  assetId: string,
  filters: VariantCandidateFilters,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Boolean(projectId && assetId),
    placeholderData: keepPreviousData,
    queryKey: assetKeys.variantCandidates(projectId, assetId, filters),
    queryFn: () =>
      assetLibraryGateway.listVariantCandidates(projectId, assetId, filters),
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
        invalidateDerivedProjectQueries(queryClient, projectId),
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: assetKeys.project(projectId),
        }),
        invalidateDerivedProjectQueries(queryClient, projectId),
      ]);
    },
  });
}

export function useResolveVariantPathMutation(
  projectId: string,
  assetId: string,
) {
  return useMutation({
    mutationFn: ({
      relativePath,
      selectedVariantIds,
    }: {
      relativePath: string;
      selectedVariantIds: string[];
    }) =>
      assetLibraryGateway.resolveVariantPath(
        projectId,
        assetId,
        relativePath,
        selectedVariantIds,
      ),
  });
}

export function useUpdateAssetVariantsMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateAssetVariantsInput, 'projectId'>) =>
      assetLibraryGateway.updateVariants({ ...input, projectId }),
    onSuccess: async (asset) => {
      queryClient.setQueryData(assetKeys.detail(projectId, asset.id), asset);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: assetKeys.project(projectId),
        }),
        invalidateDerivedProjectQueries(queryClient, projectId),
      ]);
    },
  });
}

export function useAssetActionMutation(projectId: string, assetId: string) {
  return useMutation({
    mutationFn: (action: QuickAction) =>
      assetLibraryGateway.runAction(projectId, assetId, action),
  });
}
