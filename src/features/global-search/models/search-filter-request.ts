import type { FileCategory } from '@/features/file-inventory';
import type { SearchMetadataRequest, SearchOrigin } from './search';

export const ALL_FILTER_VALUE = 'all';

export interface SearchFilterValues {
  category: string;
  environmentId: string;
  extension: string;
  modifiedFrom: string;
  modifiedTo: string;
  origin: string;
  projectId: string;
  query: string;
  status: string;
  tags: string;
}

export function composeSearchRequest(
  request: SearchMetadataRequest,
  values: SearchFilterValues,
): SearchMetadataRequest {
  const selectedProjectId =
    values.projectId === ALL_FILTER_VALUE ? null : values.projectId;

  return {
    ...request,
    categories:
      values.category === ALL_FILTER_VALUE
        ? []
        : [values.category as FileCategory],
    environmentIds:
      selectedProjectId && values.environmentId !== ALL_FILTER_VALUE
        ? [values.environmentId]
        : [],
    extensions: splitValues(values.extension, true),
    modifiedFromMs: fromDateInput(values.modifiedFrom, false),
    modifiedToMs: fromDateInput(values.modifiedTo, true),
    origins:
      values.origin === ALL_FILTER_VALUE ? [] : [values.origin as SearchOrigin],
    page: 1,
    projectId: selectedProjectId,
    query: values.query.trim(),
    statuses:
      values.status === ALL_FILTER_VALUE
        ? []
        : [values.status as 'active' | 'missing'],
    tags: splitValues(values.tags, false),
  };
}

function splitValues(value: string, trimDot: boolean): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .map((item) => (trimDot ? item.replace(/^\./, '') : item))
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

function fromDateInput(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const time = new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`,
  ).getTime();
  return Number.isSafeInteger(time) ? time : null;
}
