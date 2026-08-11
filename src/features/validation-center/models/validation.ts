import { z } from 'zod';
import {
  environmentHealthSchema,
  validationIssueSchema,
  validationIssueStatusSchema,
  validationIssueTypeSchema,
  validationRuleSchema,
  validationRuleTypeSchema,
  validationSeveritySchema,
  type EnvironmentHealth,
  type ValidationIssue,
  type ValidationIssueStatus,
  type ValidationIssueType,
  type ValidationRule,
  type ValidationRuleType,
  type ValidationSeverity,
} from '@/shared/models/validation';

export {
  environmentHealthSchema,
  validationIssueSchema,
  validationIssueStatusSchema,
  validationIssueTypeSchema,
  validationRuleSchema,
  validationRuleTypeSchema,
  validationSeveritySchema,
  type EnvironmentHealth,
  type ValidationIssue,
  type ValidationIssueStatus,
  type ValidationIssueType,
  type ValidationRule,
  type ValidationRuleType,
  type ValidationSeverity,
};

export const validationIssuePageSchema = z
  .object({
    items: z.array(validationIssueSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const validationSummarySchema = z
  .object({
    errorIssues: z.number().int().nonnegative(),
    health: environmentHealthSchema,
    ignoredIssues: z.number().int().nonnegative(),
    infoIssues: z.number().int().nonnegative(),
    lastSuccessfulAt: z.string().nullable(),
    openIssues: z.number().int().nonnegative(),
    resolvedIssues: z.number().int().nonnegative(),
    warningIssues: z.number().int().nonnegative(),
  })
  .strict();
export type ValidationSummary = z.infer<typeof validationSummarySchema>;

export const validationRunResultSchema = z
  .object({
    issuesDetected: z.number().int().nonnegative(),
    issuesResolved: z.number().int().nonnegative(),
    summary: validationSummarySchema,
  })
  .strict();

export const manifestPreviewSchema = z
  .object({
    content: z.string(),
    exists: z.boolean(),
    keyCount: z.number().int().nonnegative(),
    relativePath: z.string().min(1).max(1024),
  })
  .strict();
export type ManifestPreview = z.infer<typeof manifestPreviewSchema>;

export const manifestExportSchema = z
  .object({
    keyCount: z.number().int().nonnegative(),
    relativePath: z.string().min(1).max(1024),
    replaced: z.boolean(),
  })
  .strict();

export const validationRuleFormSchema = z.object({
  description: z.string().trim().max(2000),
  enabled: z.boolean(),
  environmentIds: z
    .array(z.string().uuid())
    .min(1, 'Select at least one environment.')
    .max(100),
  keyName: z
    .string()
    .trim()
    .min(1, 'Enter an environment key name.')
    .max(255)
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      'Use letters, numbers, and underscores, starting with a letter or underscore.',
    ),
  ruleType: validationRuleTypeSchema,
  severity: validationSeveritySchema,
});
export type ValidationRuleFormValues = z.infer<typeof validationRuleFormSchema>;

export interface ValidationIssueFilters {
  descending: boolean;
  environmentId?: string;
  issueType?: ValidationIssueType;
  page: number;
  pageSize: number;
  ruleType?: ValidationRuleType;
  search?: string;
  severity?: ValidationSeverity;
  sort: 'updated_at' | 'severity' | 'key' | 'environment' | 'status';
  status?: ValidationIssueStatus;
}

export const validationChangedPayloadSchema = z.object({
  projectId: z.string().uuid(),
});

export function validationIssueTypeLabel(type: ValidationIssueType): string {
  return type
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
