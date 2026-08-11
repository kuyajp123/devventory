import { z } from 'zod';
import {
  validationIssueSchema,
  validationRuleSchema,
  type ValidationIssue,
  type ValidationRule,
} from '@/shared/models/validation';

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

export const environmentSourceOriginSchema = z.enum(['file', 'custom']);
export type EnvironmentSourceOrigin = z.infer<
  typeof environmentSourceOriginSchema
>;

export const customEnvironmentKeySchema = z
  .object({
    createdAt: z.string().min(1),
    environmentId: z.string().uuid(),
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    normalizedName: z.string().min(1).max(255),
    projectId: z.string().uuid(),
    sourceId: z.string().uuid(),
    updatedAt: z.string().min(1),
  })
  .strict();
export type CustomEnvironmentKey = z.infer<typeof customEnvironmentKeySchema>;

export const customEnvironmentSourceSchema = z
  .object({
    createdAt: z.string().min(1),
    environmentId: z.string().uuid(),
    id: z.string().uuid(),
    keys: z.array(customEnvironmentKeySchema),
    name: z.string().min(1).max(120),
    projectId: z.string().uuid(),
    sortOrder: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  })
  .strict();
export type CustomEnvironmentSource = z.infer<
  typeof customEnvironmentSourceSchema
>;

export interface EnvironmentInspectableSource {
  id: string;
  label: string;
  origin: EnvironmentSourceOrigin;
  parseStatus: EnvironmentSource['parseStatus'];
  sortOrder: number;
}

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
    origin: environmentSourceOriginSchema,
    relativePath: z.string().min(1).nullable(),
    sourceId: z.string().uuid(),
    sourceName: z.string().min(1),
  })
  .strict();
export type EnvironmentMatrixSourceDetail = z.infer<
  typeof environmentMatrixSourceDetailSchema
>;

export type EnvironmentMatrixValidationRule = ValidationRule;
export type EnvironmentMatrixValidationIssue = ValidationIssue;

export const environmentMatrixCellValidationSchema = z
  .object({
    openIssues: z.array(validationIssueSchema),
    rules: z.array(validationRuleSchema),
  })
  .strict();
export type EnvironmentMatrixCellValidation = z.infer<
  typeof environmentMatrixCellValidationSchema
>;

export const environmentMatrixCellSchema = z
  .object({
    sourceDetails: z.array(environmentMatrixSourceDetailSchema),
    state: environmentMatrixCellStateSchema,
    validation: environmentMatrixCellValidationSchema,
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

const metadataName = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(maximum)
    .refine(
      (value) =>
        Array.from(value).every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      {
        message: 'Control characters are not allowed.',
      },
    );

export const customSourceFormSchema = z.object({
  keyNames: z.array(metadataName(255, 'Enter a custom key name.')).max(200),
  name: metadataName(120, 'Enter a custom source name.'),
});
export type CustomSourceFormValues = z.infer<typeof customSourceFormSchema>;

export const customKeyFormSchema = z.object({
  name: metadataName(255, 'Enter a custom key name.'),
});
export type CustomKeyFormValues = z.infer<typeof customKeyFormSchema>;

export interface EnvironmentPageFilters {
  environmentId?: string;
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
