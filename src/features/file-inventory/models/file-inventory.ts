import { z } from 'zod';

export const fileCategorySchema = z.enum([
  'source',
  'document',
  'image',
  'audio',
  'video',
  'archive',
  'font',
  'configuration',
  'other',
]);
export type FileCategory = z.infer<typeof fileCategorySchema>;

export const fileStatusSchema = z.enum(['active', 'missing']);
export type FileStatus = z.infer<typeof fileStatusSchema>;

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

export interface InventoryFilters {
  category?: FileCategory;
  extension?: string;
  page: number;
  pageSize: number;
  search?: string;
  status?: FileStatus;
}

export const inventoryChangedPayloadSchema = z.object({
  projectId: z.string().uuid(),
  scanId: z.string().uuid(),
  status: scanStatusSchema,
});

export const fileCategoryOptions: ReadonlyArray<{
  label: string;
  value: FileCategory;
}> = [
  { label: 'Source', value: 'source' },
  { label: 'Documents', value: 'document' },
  { label: 'Images', value: 'image' },
  { label: 'Audio', value: 'audio' },
  { label: 'Video', value: 'video' },
  { label: 'Archives', value: 'archive' },
  { label: 'Fonts', value: 'font' },
  { label: 'Configuration', value: 'configuration' },
  { label: 'Other', value: 'other' },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}
