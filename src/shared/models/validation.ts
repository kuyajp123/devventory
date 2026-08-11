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
