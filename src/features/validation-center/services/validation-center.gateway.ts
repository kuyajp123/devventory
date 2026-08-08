import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  manifestExportSchema,
  manifestPreviewSchema,
  validationIssuePageSchema,
  validationIssueSchema,
  validationRuleSchema,
  validationRunResultSchema,
  validationSummarySchema,
  type ValidationIssueFilters,
  type ValidationIssueStatus,
  type ValidationRuleFormValues,
} from '../models/validation';

export const validationCenterGateway = {
  async listRules(projectId: string) {
    const response = await invokeCommand<unknown>('list_validation_rules', {
      input: { projectId },
    });
    return validationRuleSchema.array().parse(response);
  },

  async saveRule(
    projectId: string,
    input: ValidationRuleFormValues & { ruleId?: string },
  ) {
    const response = await invokeCommand<unknown>('save_validation_rule', {
      input: { projectId, ...input },
    });
    return validationRuleSchema.parse(response);
  },

  deleteRule(projectId: string, ruleId: string) {
    return invokeCommand<void>('delete_validation_rule', {
      input: { projectId, ruleId },
    });
  },

  reorderRules(projectId: string, ruleIds: string[]) {
    return invokeCommand<void>('reorder_validation_rules', {
      input: { projectId, ruleIds },
    });
  },

  async listIssues(projectId: string, filters: ValidationIssueFilters) {
    const response = await invokeCommand<unknown>('list_validation_issues', {
      input: { projectId, ...filters },
    });
    return validationIssuePageSchema.parse(response);
  },

  async summary(projectId: string) {
    const response = await invokeCommand<unknown>('get_validation_summary', {
      input: { projectId },
    });
    return validationSummarySchema.parse(response);
  },

  async validate(projectId: string) {
    const response = await invokeCommand<unknown>('run_project_validation', {
      input: { projectId },
    });
    return validationRunResultSchema.parse(response);
  },

  async setIssueStatus(
    projectId: string,
    issueId: string,
    status: Exclude<ValidationIssueStatus, 'resolved'>,
  ) {
    const response = await invokeCommand<unknown>(
      'set_validation_issue_status',
      { input: { issueId, projectId, status } },
    );
    return validationIssueSchema.parse(response);
  },

  async previewManifest(projectId: string, relativePath: string) {
    const response = await invokeCommand<unknown>(
      'preview_environment_manifest',
      { input: { projectId, relativePath } },
    );
    return manifestPreviewSchema.parse(response);
  },

  async exportManifest(
    projectId: string,
    relativePath: string,
    collisionChoice: 'cancel' | 'replace',
  ) {
    const response = await invokeCommand<unknown>(
      'export_environment_manifest',
      { input: { collisionChoice, projectId, relativePath } },
    );
    return manifestExportSchema.parse(response);
  },
};
