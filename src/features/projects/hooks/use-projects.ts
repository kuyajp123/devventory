import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  derivedQueryKeys,
  invalidateDerivedProjectQueries,
} from '@/shared/query/derived-query-keys';
import type { Project } from '../models/project';
import { folderPickerGateway } from '../services/folder-picker.gateway';
import { projectsGateway } from '../services/projects.gateway';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
};

export function useProjectsQuery() {
  return useQuery({ queryKey: projectKeys.all, queryFn: projectsGateway.list });
}

export function useProjectQuery(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsGateway.get(projectId),
  });
}

export function useFolderPickerMutation() {
  return useMutation({
    mutationFn: () => folderPickerGateway.selectProjectRoot(),
  });
}

export function useValidateProjectRootMutation() {
  return useMutation({
    mutationFn: (rootPath: string) => projectsGateway.validateRoot(rootPath),
  });
}

export function useScanProjectMutation() {
  return useMutation({
    mutationFn: (input: Parameters<typeof projectsGateway.scan>[0]) =>
      projectsGateway.scan(input),
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof projectsGateway.create>[0]) =>
      projectsGateway.create(input),
    onSuccess: async (project) => {
      queryClient.setQueryData(projectKeys.detail(project.id), project);
      queryClient.setQueryData<Project[]>(projectKeys.all, (current = []) => [
        project,
        ...current.filter((item) => item.id !== project.id),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        invalidateDerivedProjectQueries(queryClient, project.id),
      ]);
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsGateway.delete(projectId),
    onSuccess: async (_, projectId) => {
      queryClient.setQueryData<Project[]>(projectKeys.all, (current = []) =>
        current.filter((project) => project.id !== projectId),
      );
      queryClient.removeQueries({
        exact: true,
        queryKey: projectKeys.detail(projectId),
      });
      queryClient.removeQueries({
        exact: true,
        queryKey: derivedQueryKeys.dashboard(projectId),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: derivedQueryKeys.search }),
      ]);
    },
  });
}
