import { z } from 'zod';
import {
  fileCategorySchema,
  type FileCategory,
} from '@/shared/models/indexed-file';

export const assetOriginSchema = z.enum(['managed', 'discovered']);
export type AssetOrigin = z.infer<typeof assetOriginSchema>;

export const assetSortFieldSchema = z.enum([
  'relativePath',
  'name',
  'category',
  'sizeBytes',
  'modifiedAtMs',
  'updatedAt',
]);
export type AssetSortField = z.infer<typeof assetSortFieldSchema>;

export const sortDirectionSchema = z.enum(['ascending', 'descending']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const collisionChoiceSchema = z.enum([
  'cancel',
  'replace',
  'keep_both',
  'rename',
]);
export type CollisionChoice = z.infer<typeof collisionChoiceSchema>;

export const quickActionSchema = z.enum([
  'open',
  'reveal',
  'open_in_vscode',
  'copy_relative_path',
  'copy_absolute_path',
]);
export type QuickAction = z.infer<typeof quickActionSchema>;

export const assetSchema = z.object({
  category: fileCategorySchema,
  extension: z.string().nullable(),
  favorite: z.boolean(),
  id: z.string().uuid(),
  mimeType: z.string().nullable(),
  modifiedAtMs: z.number().int().safe().nullable(),
  name: z.string().min(1),
  note: z.string().nullable(),
  origin: assetOriginSchema,
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().safe(),
  status: z.enum(['active', 'missing']),
  tags: z.array(z.string().min(1)),
  updatedAt: z.string().min(1),
  variantIds: z.array(z.string().uuid()),
});
export type Asset = z.infer<typeof assetSchema>;

const duplicateMatchSchema = z.object({
  assetId: z.string().uuid(),
  relativePath: z.string().min(1),
});

export const assetPreviewSchema = z.object({
  category: fileCategorySchema,
  duplicate: duplicateMatchSchema.nullable(),
  extension: z.string().nullable(),
  mimeType: z.string().nullable(),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().safe(),
});
export type AssetPreview = z.infer<typeof assetPreviewSchema>;

export const assetPageSchema = z.object({
  items: z.array(assetSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type AssetPage = z.infer<typeof assetPageSchema>;

export const importResultSchema = z.object({
  asset: assetSchema.nullable(),
  duplicate: duplicateMatchSchema.nullable(),
  status: z.enum(['imported', 'cancelled']),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export interface AssetFilters {
  category?: FileCategory;
  extension?: string;
  favorite?: boolean;
  origin?: AssetOrigin;
  page: number;
  pageSize: number;
  search?: string;
  sortBy: AssetSortField;
  sortDirection: SortDirection;
  tag?: string;
}

export interface ImportAssetInput {
  collision: CollisionChoice;
  destination: string;
  favorite: boolean;
  filename?: string;
  note?: string;
  projectId: string;
  sourcePath: string;
  tags: string[];
}

export interface UpdateAssetMetadataInput {
  assetId: string;
  favorite: boolean;
  note?: string;
  projectId: string;
  tags: string[];
  variantIds: string[];
}

export const variantCandidateScopeSchema = z.enum([
  'suggested',
  'same_folder',
  'asset_root',
  'managed',
  'all',
]);
export type VariantCandidateScope = z.infer<typeof variantCandidateScopeSchema>;

export const variantCandidateSchema = z.object({
  category: fileCategorySchema,
  extension: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1),
  origin: assetOriginSchema,
  reasons: z.object({
    compatibleType: z.boolean(),
    matchingMetadata: z.boolean(),
    sameAssetRoot: z.boolean(),
    sameFolder: z.boolean(),
    similarName: z.boolean(),
  }),
  relativePath: z.string().min(1),
  status: z.enum(['active', 'missing']),
});
export type VariantCandidate = z.infer<typeof variantCandidateSchema>;

export const variantCandidatePageSchema = z.object({
  assetRoot: z.string().min(1),
  currentFolder: z.string().min(1),
  hasMore: z.boolean(),
  items: z.array(variantCandidateSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(50),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type VariantCandidatePage = z.infer<typeof variantCandidatePageSchema>;

export interface VariantCandidateFilters {
  excludedIds: string[];
  page: number;
  pageSize: number;
  scope: VariantCandidateScope;
  search?: string;
}

export interface UpdateAssetVariantsInput {
  assetId: string;
  projectId: string;
  variantIds: string[];
}

export const variantPathSchema = z
  .string()
  .trim()
  .min(1, 'Enter a project-relative file path.')
  .max(1_024, 'Use a path with 1,024 characters or fewer.')
  .refine(
    (value) => !/^(?:[a-zA-Z]:[\\/]|[\\/])/.test(value),
    'Use a path relative to this project, not an absolute path.',
  )
  .refine(
    (value) => !value.split(/[\\/]/).includes('..'),
    'The path cannot leave the project root.',
  );

export const assetImportFormSchema = z
  .object({
    collision: collisionChoiceSchema,
    destination: z.string().trim().min(1, 'Choose a project destination.'),
    favorite: z.boolean(),
    filename: z.string().trim().max(255, 'Use 255 characters or fewer.'),
    note: z.string().trim().max(10_000, 'Use 10,000 characters or fewer.'),
    tagsText: z.string().max(839, 'Use no more than 20 short tags.'),
  })
  .superRefine((values, context) => {
    if (values.collision === 'rename' && !values.filename) {
      context.addIssue({
        code: 'custom',
        message: 'Enter a destination filename when using Rename.',
        path: ['filename'],
      });
    }
    const tags = parseTags(values.tagsText);
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      context.addIssue({
        code: 'custom',
        message: 'Use at most 20 tags with 40 characters or fewer.',
        path: ['tagsText'],
      });
    }
  });

export type AssetImportFormValues = z.infer<typeof assetImportFormSchema>;

export const assetMetadataFormSchema = z
  .object({
    favorite: z.boolean(),
    note: z.string().trim().max(10_000, 'Use 10,000 characters or fewer.'),
    tagsText: z.string().max(839, 'Use no more than 20 short tags.'),
  })
  .superRefine((values, context) => {
    const tags = parseTags(values.tagsText);
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      context.addIssue({
        code: 'custom',
        message: 'Use at most 20 tags with 40 characters or fewer.',
        path: ['tagsText'],
      });
    }
  });
export type AssetMetadataFormValues = z.infer<typeof assetMetadataFormSchema>;

export function parseTags(value: string): string[] {
  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.filter(
    (tag, index) =>
      tags.findIndex(
        (candidate) => candidate.toLowerCase() === tag.toLowerCase(),
      ) === index,
  );
}

export function isImportDestinationAllowed(
  destination: string,
  watchedLocations: string[],
): boolean {
  const normalizedDestination = normalizeRelativeFolder(destination);
  if (!normalizedDestination) return false;

  return watchedLocations.some((location) => {
    const normalizedLocation = normalizeRelativeFolder(location);
    if (!normalizedLocation) return false;
    return (
      normalizedLocation === '.' ||
      normalizedDestination === normalizedLocation ||
      normalizedDestination.startsWith(`${normalizedLocation}/`)
    );
  });
}

function normalizeRelativeFolder(value: string): string | null {
  const normalized = value.trim().replace(/\/+$/, '') || '.';
  if (
    normalized.includes('\\') ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    return null;
  }
  const segments = normalized.split('/');
  if (
    segments.some(
      (segment) =>
        !segment || segment === '..' || (segment === '.' && normalized !== '.'),
    )
  ) {
    return null;
  }
  return normalized;
}
