import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InventoryFilters } from '../models/file-inventory';
import { fileInventoryGateway } from '../services/file-inventory.gateway';

export const fileInventoryKeys = {
  all: ['file-inventory'] as const,
  project: (projectId: string) => ['file-inventory', projectId] as const,
  list: (projectId: string, filters: InventoryFilters) =>
    ['file-inventory', projectId, filters] as const,
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

export function useRescanProjectMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fileInventoryGateway.rescanProject(projectId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: fileInventoryKeys.project(projectId),
      });
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
    },
  });
}
