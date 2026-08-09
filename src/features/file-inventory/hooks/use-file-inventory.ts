import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invalidateDerivedProjectQueries } from '@/shared/query/derived-query-keys';
import type {
  InventoryFilters,
  ProjectDirectoryPage,
} from '../models/file-inventory';
import { fileInventoryGateway } from '../services/file-inventory.gateway';

export const fileInventoryKeys = {
  all: ['file-inventory'] as const,
  project: (projectId: string) => ['file-inventory', projectId] as const,
  list: (projectId: string, filters: InventoryFilters) =>
    ['file-inventory', projectId, 'list', filters] as const,
  directory: (projectId: string, relativePath: string) =>
    ['file-inventory', projectId, 'directory', relativePath] as const,
};

export function useFileInventoryQuery(
  projectId: string,
  filters: InventoryFilters,
) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: fileInventoryKeys.list(projectId, filters),
    queryFn: () => fileInventoryGateway.list(projectId, filters),
  });
}

export function useProjectDirectoryQuery(
  projectId: string,
  relativePath: string,
  enabled = true,
) {
  return useInfiniteQuery<
    ProjectDirectoryPage,
    Error,
    InfiniteData<ProjectDirectoryPage>,
    ReturnType<typeof fileInventoryKeys.directory>,
    number
  >({
    enabled: enabled && Boolean(projectId) && Boolean(relativePath),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryKey: fileInventoryKeys.directory(projectId, relativePath),
    queryFn: ({ pageParam }) =>
      fileInventoryGateway.listDirectory(
        projectId,
        relativePath,
        pageParam,
        100,
      ),
    staleTime: 30_000,
  });
}

export function useRescanProjectMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fileInventoryGateway.rescanProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: fileInventoryKeys.project(projectId),
      });
      await invalidateDerivedProjectQueries(queryClient, projectId);
    },
  });
}

export function useRescanWatchedLocationMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (watchedLocationId: string) =>
      fileInventoryGateway.rescanWatchedLocation(projectId, watchedLocationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: fileInventoryKeys.project(projectId),
      });
      await invalidateDerivedProjectQueries(queryClient, projectId);
    },
  });
}
