import { z } from 'zod';

export const environmentSchema = z
  .object({
    createdAt: z.string().min(1),
    description: z.string().nullable(),
    id: z.string().uuid(),
    name: z.string().min(1).max(120),
    projectId: z.string().uuid(),
    sortOrder: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  })
  .strict();
export type Environment = z.infer<typeof environmentSchema>;

export const environmentSourceParseStatusSchema = z.enum([
  'not_parsed',
  'parsed',
  'missing',
  'unreadable',
  'parse_issue',
  'unsupported_encoding',
]);
export type EnvironmentSourceParseStatus = z.infer<
  typeof environmentSourceParseStatusSchema
>;

export const environmentSourceSchema = z
  .object({
    createdAt: z.string().min(1),
    environmentId: z.string().uuid(),
    id: z.string().uuid(),
    lastIssueCode: z.string().nullable(),
    lastIssueLine: z.number().int().positive().nullable(),
    lastIssueMessage: z.string().nullable(),
    lastObservedModifiedAtMs: z.number().int().safe().nullable(),
    lastObservedSizeBytes: z.number().int().nonnegative().safe().nullable(),
    lastParsedAt: z.string().nullable(),
    lastSuccessfulParseAt: z.string().nullable(),
    parseStatus: environmentSourceParseStatusSchema,
    projectId: z.string().uuid(),
    relativePath: z.string().min(1),
    sortOrder: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  })
  .strict();
export type EnvironmentSource = z.infer<typeof environmentSourceSchema>;

export const environmentSourceCandidateSchema = z
  .object({
    extension: z.string().nullable(),
    name: z.string().min(1),
    relativePath: z.string().min(1),
  })
  .strict();
export type EnvironmentSourceCandidate = z.infer<
  typeof environmentSourceCandidateSchema
>;

export const environmentSourceCandidatePageSchema = z
  .object({
    items: z.array(environmentSourceCandidateSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();
export type EnvironmentSourceCandidatePage = z.infer<
  typeof environmentSourceCandidatePageSchema
>;

export const environmentMatrixCellStateSchema = z.enum([
  'present',
  'duplicate',
  'commented',
  'absent',
  'source_unreadable',
  'parse_issue',
]);
export type EnvironmentMatrixCellState = z.infer<
  typeof environmentMatrixCellStateSchema
>;

export const environmentMatrixSourceDetailSchema = z
  .object({
    isCommented: z.boolean(),
    lineNumber: z.number().int().positive().nullable(),
    relativePath: z.string().min(1),
  })
  .strict();
export type EnvironmentMatrixSourceDetail = z.infer<
  typeof environmentMatrixSourceDetailSchema
>;

export const environmentMatrixCellSchema = z
  .object({
    sourceDetails: z.array(environmentMatrixSourceDetailSchema),
    state: environmentMatrixCellStateSchema,
  })
  .strict();
export type EnvironmentMatrixCell = z.infer<typeof environmentMatrixCellSchema>;

export const environmentMatrixRowSchema = z
  .object({
    cells: z.array(environmentMatrixCellSchema),
    keyName: z.string().min(1),
  })
  .strict();
export type EnvironmentMatrixRow = z.infer<typeof environmentMatrixRowSchema>;

export const environmentMatrixPageSchema = z
  .object({
    environments: z.array(environmentSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    rows: z.array(environmentMatrixRowSchema),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();
export type EnvironmentMatrixPage = z.infer<typeof environmentMatrixPageSchema>;

export const environmentFormSchema = z.object({
  description: z.string().trim().max(2000),
  name: z.string().trim().min(1, 'Enter an environment name.').max(120),
});
export type EnvironmentFormValues = z.infer<typeof environmentFormSchema>;

export interface EnvironmentPageFilters {
  page: number;
  pageSize: number;
  search?: string;
}

export const environmentChangedPayloadSchema = z.object({
  projectId: z.string().uuid(),
});

export function sourceStatusLabel(
  status: EnvironmentSourceParseStatus,
): string {
  switch (status) {
    case 'parsed':
      return 'Parsed';
    case 'missing':
      return 'Missing';
    case 'unreadable':
      return 'Unreadable';
    case 'parse_issue':
      return 'Parse issue';
    case 'unsupported_encoding':
      return 'Unsupported encoding';
    default:
      return 'Not parsed';
  }
}
