import { z } from 'zod';
import {
  fileCategorySchema,
  type FileCategory,
} from '@/shared/models/indexed-file';

export {
  fileCategoryOptions,
  fileCategorySchema,
  formatFileSize,
} from '@/shared/models/indexed-file';
export type { FileCategory } from '@/shared/models/indexed-file';

export const fileStatusSchema = z.enum(['active', 'missing']);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const inventorySortFieldSchema = z.enum([
  'relativePath',
  'name',
  'category',
  'sizeBytes',
  'modifiedAtMs',
  'status',
]);
export type InventorySortField = z.infer<typeof inventorySortFieldSchema>;

export const sortDirectionSchema = z.enum(['ascending', 'descending']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const scanStatusSchema = z.enum([
  'running',
  'completed',
  'partial',
  'failed',
]);

export const scanRunSchema = z.object({
  completedAt: z.string().nullable(),
  directoriesVisited: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  entriesExcluded: z.number().int().nonnegative(),
  entriesUnreadable: z.number().int().nonnegative(),
  errorSummary: z.string().nullable(),
  filesAdded: z.number().int().nonnegative(),
  filesDiscovered: z.number().int().nonnegative(),
  filesMissing: z.number().int().nonnegative(),
  filesUnchanged: z.number().int().nonnegative(),
  filesUpdated: z.number().int().nonnegative(),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  scanType: z.enum([
    'initial',
    'startup',
    'manual_project',
    'manual_location',
    'watcher',
  ]),
  startedAt: z.string().min(1),
  status: scanStatusSchema,
  watchedLocationId: z.string().uuid().nullable(),
});
export type ScanRun = z.infer<typeof scanRunSchema>;

export const indexedFileSchema = z.object({
  category: fileCategorySchema,
  extension: z.string().nullable(),
  firstSeenAt: z.string().min(1),
  id: z.string().uuid(),
  lastSeenAt: z.string().min(1),
  mimeType: z.string().nullable(),
  modifiedAtMs: z.number().int().nonnegative().safe().nullable(),
  name: z.string().min(1),
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().safe(),
  sourceType: z.literal('discovered'),
  status: fileStatusSchema,
  updatedAt: z.string().min(1),
  watchedLocationId: z.string().uuid().nullable(),
});
export type IndexedFile = z.infer<typeof indexedFileSchema>;

export const inventoryWatchedLocationSchema = z.object({
  id: z.string().uuid(),
  relativePath: z.string().min(1),
});
export type InventoryWatchedLocation = z.infer<
  typeof inventoryWatchedLocationSchema
>;

export const inventoryPageSchema = z.object({
  items: z.array(indexedFileSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  recentScans: z.array(scanRunSchema).max(5),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  watchedLocations: z.array(inventoryWatchedLocationSchema),
});
export type InventoryPage = z.infer<typeof inventoryPageSchema>;

const projectRelativeDirectorySchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !value.split('/').includes('..'),
    'Expected a safe project-relative directory path.',
  );

export const projectDirectoryEntrySchema = z.object({
  isWatched: z.boolean(),
  name: z.string().min(1),
  relativePath: projectRelativeDirectorySchema,
});
export type ProjectDirectoryEntry = z.infer<typeof projectDirectoryEntrySchema>;

export const projectDirectoryPageSchema = z.object({
  entriesUnreadable: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  items: z.array(projectDirectoryEntrySchema).max(100),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type ProjectDirectoryPage = z.infer<typeof projectDirectoryPageSchema>;

export interface InventoryFilters {
  category?: FileCategory;
  extension?: string;
  page: number;
  pageSize: number;
  parentFolder?: string;
  search?: string;
  sortBy: InventorySortField;
  sortDirection: SortDirection;
  status?: FileStatus;
}

export const inventoryChangedPayloadSchema = z.object({
  projectId: z.string().uuid(),
  scanId: z.string().uuid(),
  status: scanStatusSchema,
});
