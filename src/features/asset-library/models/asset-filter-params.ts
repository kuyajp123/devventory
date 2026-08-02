import { fileCategorySchema } from '@/features/file-inventory';
import {
  assetOriginSchema,
  assetSortFieldSchema,
  sortDirectionSchema,
  type AssetFilters,
} from './asset';

export const ASSET_PAGE_SIZE = 30;

export function readAssetFilters(params: URLSearchParams): AssetFilters {
  const rawPage = Number(params.get('page') ?? '1');
  const category = fileCategorySchema.safeParse(params.get('category'));
  const origin = assetOriginSchema.safeParse(params.get('origin'));
  const sortBy = assetSortFieldSchema.safeParse(params.get('sort'));
  const direction = sortDirectionSchema.safeParse(params.get('direction'));
  return {
    category: category.success ? category.data : undefined,
    extension: params.get('extension') || undefined,
    favorite: params.get('favorite') === 'true' ? true : undefined,
    origin: origin.success ? origin.data : undefined,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: ASSET_PAGE_SIZE,
    search: params.get('q') || undefined,
    sortBy: sortBy.success ? sortBy.data : 'relativePath',
    sortDirection: direction.success ? direction.data : 'ascending',
    tag: params.get('tag') || undefined,
  };
}

export function writeAssetFilters(filters: AssetFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.extension) params.set('extension', filters.extension);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.favorite) params.set('favorite', 'true');
  if (filters.origin) params.set('origin', filters.origin);
  if (filters.sortBy !== 'relativePath') params.set('sort', filters.sortBy);
  if (filters.sortDirection !== 'ascending') {
    params.set('direction', filters.sortDirection);
  }
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}

export function hasAssetFilters(filters: AssetFilters): boolean {
  return Boolean(
    filters.search ||
    filters.category ||
    filters.extension ||
    filters.tag ||
    filters.favorite ||
    filters.origin,
  );
}
