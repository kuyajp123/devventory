import { toast } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  useDeleteValidationRuleMutation,
  useReorderValidationRulesMutation,
  useRunValidationMutation,
  useSaveValidationRuleMutation,
  useSetValidationIssueStatusMutation,
  useValidationIssuesQuery,
  useValidationRulesQuery,
  useValidationSummaryQuery,
} from './use-validation-center';
import type {
  ValidationIssue,
  ValidationIssueFilters,
  ValidationRule,
  ValidationRuleFormValues,
} from '../models/validation';

export const defaultValidationIssueFilters: ValidationIssueFilters = {
  descending: true,
  page: 1,
  pageSize: 25,
  sort: 'updated_at',
  status: 'open',
};

export function useValidationWorkspace(projectId: string, loadIssues: boolean) {
  const [filters, setFilters] = useState(defaultValidationIssueFilters);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const rules = useValidationRulesQuery(projectId);
  const summary = useValidationSummaryQuery(projectId);
  const issues = useValidationIssuesQuery(projectId, filters, loadIssues);
  const saveRule = useSaveValidationRuleMutation(projectId);
  const deleteRule = useDeleteValidationRuleMutation(projectId);
  const reorderRules = useReorderValidationRulesMutation(projectId);
  const runValidation = useRunValidationMutation(projectId);
  const setIssueStatus = useSetValidationIssueStatusMutation(projectId);
  const previousProjectId = useRef(projectId);

  useEffect(() => {
    if (previousProjectId.current === projectId) return;
    previousProjectId.current = projectId;
    setFilters(defaultValidationIssueFilters);
    setEditingRule(null);
    setIsRuleModalOpen(false);
    setIsManifestOpen(false);
  }, [projectId]);

  async function submitRule(values: ValidationRuleFormValues) {
    try {
      await saveRule.mutateAsync({
        ...values,
        ...(editingRule ? { ruleId: editingRule.id } : {}),
      });
      toast.success(
        editingRule ? 'Validation rule updated' : 'Validation rule created',
      );
      closeRuleModal();
    } catch (error) {
      toast.danger(safeError(error, 'The validation rule could not be saved.'));
    }
  }

  async function validateNow() {
    try {
      const result = await runValidation.mutateAsync();
      toast.success(
        `Validation complete: ${result.issuesDetected} issues detected, ${result.issuesResolved} resolved.`,
      );
    } catch (error) {
      toast.danger(
        safeError(error, 'Project validation could not be completed.'),
      );
    }
  }

  async function changeIssueStatus(issue: ValidationIssue) {
    try {
      await setIssueStatus.mutateAsync({
        issueId: issue.id,
        status: issue.status === 'ignored' ? 'open' : 'ignored',
      });
      toast.success(
        issue.status === 'ignored' ? 'Issue reopened' : 'Issue ignored',
      );
    } catch (error) {
      toast.danger(safeError(error, 'The issue status could not be changed.'));
    }
  }

  async function removeRule(rule: ValidationRule) {
    try {
      await deleteRule.mutateAsync(rule.id);
      toast.success('Validation rule deleted');
    } catch (error) {
      toast.danger(
        safeError(error, 'The validation rule could not be deleted.'),
      );
    }
  }

  async function reorderRuleIds(ruleIds: string[]) {
    try {
      await reorderRules.mutateAsync(ruleIds);
    } catch (error) {
      toast.danger(safeError(error, 'The rule order could not be saved.'));
      throw error;
    }
  }

  async function toggleRule(rule: ValidationRule) {
    try {
      await saveRule.mutateAsync({
        description: rule.description ?? '',
        enabled: !rule.enabled,
        environmentIds: rule.environmentIds,
        keyName: rule.keyName,
        ruleId: rule.id,
        ruleType: rule.ruleType,
        severity: rule.severity,
      });
      toast.success(
        rule.enabled ? 'Validation rule disabled' : 'Validation rule enabled',
      );
    } catch (error) {
      toast.danger(
        safeError(error, 'The validation rule could not be updated.'),
      );
    }
  }

  function openCreateRule() {
    setEditingRule(null);
    setIsRuleModalOpen(true);
  }

  function openEditRule(rule: ValidationRule) {
    setEditingRule(rule);
    setIsRuleModalOpen(true);
  }

  function closeRuleModal() {
    setIsRuleModalOpen(false);
    setEditingRule(null);
  }

  return {
    changeIssueStatus,
    closeRuleModal,
    deleteRule,
    editingRule,
    filters,
    isManifestOpen,
    isRuleModalOpen,
    issues,
    openCreateRule,
    openEditRule,
    removeRule,
    reorderRuleIds,
    reorderRules,
    rules,
    runValidation,
    saveRule,
    setFilters,
    setIsManifestOpen,
    setIsRuleModalOpen,
    setIssueStatus,
    submitRule,
    summary,
    toggleRule,
    validateNow,
  };
}

export type ValidationWorkspaceController = ReturnType<
  typeof useValidationWorkspace
>;

function safeError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
