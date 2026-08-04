import { z } from 'zod';

export const environmentSourceStatusSchema = z.enum([
  'ready',
  'missing',
  'unreadable',
  'parse_error',
]);
export const environmentParseStatusSchema = z.enum([
  'pending',
  'parsed',
  'failed',
]);

export const environmentSourceSchema = z.object({
  createdAt: z.string().min(1),
  environmentId: z.string().uuid(),
  id: z.string().uuid(),
  issueCount: z.number().int().nonnegative(),
  lastParsedAt: z.string().nullable(),
  modifiedAtMs: z.number().int().safe().nullable(),
  parseStatus: environmentParseStatusSchema,
  priority: z.number().int().nonnegative(),
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().safe().nullable(),
  status: environmentSourceStatusSchema,
  updatedAt: z.string().min(1),
});
export type EnvironmentSource = z.infer<typeof environmentSourceSchema>;

export const projectEnvironmentSchema = z.object({
  createdAt: z.string().min(1),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  projectId: z.string().uuid(),
  sortOrder: z.number().int().nonnegative(),
  sources: z.array(environmentSourceSchema),
  updatedAt: z.string().min(1),
});
export type ProjectEnvironment = z.infer<typeof projectEnvironmentSchema>;

export const sourceCandidateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  relativePath: z.string().min(1),
  status: z.string().min(1),
});
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;

export const sourceCandidatePageSchema = z.object({
  items: z.array(sourceCandidateSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const matrixCellStateSchema = z.enum([
  'present',
  'duplicate',
  'commented',
  'absent',
  'source_unreadable',
  'parse_issue',
]);
export type MatrixCellState = z.infer<typeof matrixCellStateSchema>;

export const matrixOccurrenceSchema = z.object({
  commented: z.boolean(),
  duplicate: z.boolean(),
  lineNumber: z.number().int().positive(),
  relativePath: z.string().min(1),
  sourceId: z.string().uuid(),
  sourcePriority: z.number().int().nonnegative(),
});

export const matrixCellSchema = z.object({
  duplicateCount: z.number().int().nonnegative(),
  environmentId: z.string().uuid(),
  occurrences: z.array(matrixOccurrenceSchema),
  state: matrixCellStateSchema,
});

export const matrixRowSchema = z.object({
  cells: z.array(matrixCellSchema),
  keyDefinitionId: z.string().uuid(),
  keyName: z.string().min(1),
});

export const matrixColumnSchema = z.object({
  environmentId: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const environmentMatrixPageSchema = z.object({
  columns: z.array(matrixColumnSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  rows: z.array(matrixRowSchema),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type EnvironmentMatrixPage = z.infer<typeof environmentMatrixPageSchema>;

export const refreshSummarySchema = z.object({
  issuesFound: z.number().int().nonnegative(),
  keysFound: z.number().int().nonnegative(),
  sourcesParsed: z.number().int().nonnegative(),
  sourcesRequested: z.number().int().nonnegative(),
  sourcesUnavailable: z.number().int().nonnegative(),
});
export type RefreshSummary = z.infer<typeof refreshSummarySchema>;

export const environmentChangedPayloadSchema = z.object({
  projectId: z.string().uuid(),
  sourcesRefreshed: z.number().int().nonnegative(),
});

export const environmentFormSchema = z.object({
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1, 'Environment name is required.').max(80),
});
export type EnvironmentFormValues = z.infer<typeof environmentFormSchema>;

export const sourceFormSchema = z.object({
  relativePath: z.string().trim().min(1, 'Select a project source file.'),
});
export type SourceFormValues = z.infer<typeof sourceFormSchema>;

export const environmentSuggestions = [
  'Local',
  'Development',
  'Testing',
  'Staging',
  'Production',
] as const;
