import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ValidationIssueFilters,
  ValidationIssueStatus,
  ValidationRuleFormValues,
} from '../models/validation';
import { validationCenterGateway } from '../services/validation-center.gateway';

export const validationKeys = {
  all: ['validation-center'] as const,
  project: (projectId: string) => ['validation-center', projectId] as const,
  rules: (projectId: string) =>
    ['validation-center', projectId, 'rules'] as const,
  summary: (projectId: string) =>
    ['validation-center', projectId, 'summary'] as const,
  issues: (projectId: string, filters: ValidationIssueFilters) =>
    ['validation-center', projectId, 'issues', filters] as const,
};

function useValidationInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: validationKeys.project(projectId),
    });
}

export function useValidationRulesQuery(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () => validationCenterGateway.listRules(projectId),
    queryKey: validationKeys.rules(projectId),
  });
}

export function useValidationSummaryQuery(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () => validationCenterGateway.summary(projectId),
    queryKey: validationKeys.summary(projectId),
  });
}

export function useValidationIssuesQuery(
  projectId: string,
  filters: ValidationIssueFilters,
) {
  return useQuery({
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
    queryFn: () => validationCenterGateway.listIssues(projectId, filters),
    queryKey: validationKeys.issues(projectId, filters),
  });
}

export function useSaveValidationRuleMutation(projectId: string) {
  const invalidate = useValidationInvalidation(projectId);
  return useMutation({
    mutationFn: (input: ValidationRuleFormValues & { ruleId?: string }) =>
      validationCenterGateway.saveRule(projectId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteValidationRuleMutation(projectId: string) {
  const invalidate = useValidationInvalidation(projectId);
  return useMutation({
    mutationFn: (ruleId: string) =>
      validationCenterGateway.deleteRule(projectId, ruleId),
    onSuccess: invalidate,
  });
}

export function useReorderValidationRulesMutation(projectId: string) {
  const invalidate = useValidationInvalidation(projectId);
  return useMutation({
    mutationFn: (ruleIds: string[]) =>
      validationCenterGateway.reorderRules(projectId, ruleIds),
    onSuccess: invalidate,
  });
}

export function useRunValidationMutation(projectId: string) {
  const invalidate = useValidationInvalidation(projectId);
  return useMutation({
    mutationFn: () => validationCenterGateway.validate(projectId),
    onSuccess: invalidate,
  });
}

export function useSetValidationIssueStatusMutation(projectId: string) {
  const invalidate = useValidationInvalidation(projectId);
  return useMutation({
    mutationFn: (input: {
      issueId: string;
      status: Exclude<ValidationIssueStatus, 'resolved'>;
    }) =>
      validationCenterGateway.setIssueStatus(
        projectId,
        input.issueId,
        input.status,
      ),
    onSuccess: invalidate,
  });
}

export function useManifestPreviewMutation(projectId: string) {
  return useMutation({
    mutationFn: (relativePath: string) =>
      validationCenterGateway.previewManifest(projectId, relativePath),
  });
}

export function useExportManifestMutation(projectId: string) {
  return useMutation({
    mutationFn: (input: {
      collisionChoice: 'cancel' | 'replace';
      relativePath: string;
    }) =>
      validationCenterGateway.exportManifest(
        projectId,
        input.relativePath,
        input.collisionChoice,
      ),
  });
}
