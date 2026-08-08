import { z } from 'zod';
import { fileCategorySchema } from '@/features/file-inventory';

export const searchOriginSchema = z.enum(['managed', 'discovered']);
export type SearchOrigin = z.infer<typeof searchOriginSchema>;

export const searchSortFieldSchema = z.enum([
  'relevance',
  'name',
  'project',
  'modified',
]);
export type SearchSortField = z.infer<typeof searchSortFieldSchema>;

export const searchSortDirectionSchema = z.enum(['ascending', 'descending']);
export type SearchSortDirection = z.infer<typeof searchSortDirectionSchema>;

export const searchMetadataRequestSchema = z.object({
  categories: z.array(fileCategorySchema).max(50),
  environmentIds: z.array(z.string().uuid()).max(50),
  extensions: z.array(z.string().min(1).max(32)).max(50),
  modifiedFromMs: z.number().int().safe().nullable(),
  modifiedToMs: z.number().int().safe().nullable(),
  origins: z.array(searchOriginSchema).max(50),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  projectId: z.string().uuid().nullable(),
  query: z.string().max(256),
  sortBy: searchSortFieldSchema,
  sortDirection: searchSortDirectionSchema,
  statuses: z.array(z.enum(['active', 'missing'])).max(50),
  tags: z.array(z.string().min(1).max(40)).max(50),
});
export type SearchMetadataRequest = z.infer<typeof searchMetadataRequestSchema>;

const baseResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
});

const projectResultSchema = baseResultSchema.extend({
  resultType: z.literal('project'),
});

const fileResultSchema = baseResultSchema.extend({
  category: fileCategorySchema,
  extension: z.string().nullable(),
  modifiedAtMs: z.number().int().safe().nullable(),
  note: z.string().nullable(),
  origin: searchOriginSchema,
  relativePath: z.string().min(1),
  resultType: z.literal('file'),
  status: z.enum(['active', 'missing']),
  tags: z.array(z.string()),
});

const environmentKeyResultSchema = baseResultSchema.extend({
  environmentId: z.string().uuid(),
  environmentName: z.string().min(1),
  resultType: z.literal('environment_key'),
});

export const searchResultSchema = z.discriminatedUnion('resultType', [
  projectResultSchema,
  fileResultSchema,
  environmentKeyResultSchema,
]);
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchMetadataPageSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(searchResultSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type SearchMetadataPage = z.infer<typeof searchMetadataPageSchema>;

export const searchHistoryEntrySchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().uuid(),
  request: searchMetadataRequestSchema,
});
export type SearchHistoryEntry = z.infer<typeof searchHistoryEntrySchema>;

export const searchHistorySchema = z.array(searchHistoryEntrySchema).max(20);

export const DEFAULT_SEARCH_REQUEST: SearchMetadataRequest = {
  categories: [],
  environmentIds: [],
  extensions: [],
  modifiedFromMs: null,
  modifiedToMs: null,
  origins: [],
  page: 1,
  pageSize: 25,
  projectId: null,
  query: '',
  sortBy: 'relevance',
  sortDirection: 'ascending',
  statuses: [],
  tags: [],
};

export function resultContext(result: SearchResult): string {
  if (result.resultType === 'file') return result.relativePath;
  if (result.resultType === 'environment_key') {
    return `Environment: ${result.environmentName}`;
  }
  return 'Project';
}
