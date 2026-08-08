import { z } from 'zod';

export const validationRuleTypeSchema = z.enum([
  'required',
  'optional',
  'forbidden',
]);
export type ValidationRuleType = z.infer<typeof validationRuleTypeSchema>;

export const validationSeveritySchema = z.enum(['info', 'warning', 'error']);
export type ValidationSeverity = z.infer<typeof validationSeveritySchema>;

export const validationIssueTypeSchema = z.enum([
  'required_missing',
  'required_commented',
  'forbidden_present',
  'unexpected_present',
  'duplicate',
  'case_mismatch',
  'invalid_name',
  'source_unreadable',
  'parse_issue',
]);
export type ValidationIssueType = z.infer<typeof validationIssueTypeSchema>;

export const validationIssueStatusSchema = z.enum([
  'open',
  'ignored',
  'resolved',
]);
export type ValidationIssueStatus = z.infer<typeof validationIssueStatusSchema>;

export const environmentHealthSchema = z.enum([
  'healthy',
  'warning',
  'error',
  'unknown',
]);
export type EnvironmentHealth = z.infer<typeof environmentHealthSchema>;

export const validationRuleSchema = z
  .object({
    createdAt: z.string().min(1),
    description: z.string().nullable(),
    enabled: z.boolean(),
    environmentIds: z.array(z.string().uuid()).min(1).max(100),
    id: z.string().uuid(),
    keyName: z.string().min(1).max(255),
    projectId: z.string().uuid(),
    ruleType: validationRuleTypeSchema,
    severity: validationSeveritySchema,
    sortOrder: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  })
  .strict();
export type ValidationRule = z.infer<typeof validationRuleSchema>;

export const validationIssueSchema = z
  .object({
    environmentId: z.string().uuid().nullable(),
    environmentName: z.string().nullable(),
    firstSeenAt: z.string().min(1),
    id: z.string().uuid(),
    issueType: validationIssueTypeSchema,
    keyName: z.string().min(1).max(255),
    lastSeenAt: z.string().min(1),
    lineNumber: z.number().int().positive().nullable(),
    message: z.string().min(1).max(500),
    observedName: z.string().max(255).nullable(),
    projectId: z.string().uuid(),
    resolvedAt: z.string().nullable(),
    ruleId: z.string().uuid().nullable(),
    severity: validationSeveritySchema,
    sourcePath: z.string().max(1024).nullable(),
    status: validationIssueStatusSchema,
    updatedAt: z.string().min(1),
  })
  .strict();
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

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
