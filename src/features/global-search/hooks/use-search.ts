import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { derivedQueryKeys } from '@/shared/query/derived-query-keys';
import type { SearchMetadataRequest } from '../models/search';
import { searchGateway } from '../services/search.gateway';

export const searchKeys = {
  all: derivedQueryKeys.search,
  history: () => [...derivedQueryKeys.search, 'history'] as const,
  results: (request: SearchMetadataRequest) =>
    [...derivedQueryKeys.search, 'results', request] as const,
};

export function useSearchQuery(request: SearchMetadataRequest) {
  return useQuery({
    networkMode: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => searchGateway.search(request),
    queryKey: searchKeys.results(request),
  });
}

export function useSearchHistoryQuery() {
  return useQuery({
    networkMode: 'always',
    queryFn: searchGateway.history,
    queryKey: searchKeys.history(),
  });
}

export function useRecordSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: searchGateway.recordHistory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: searchKeys.history() });
    },
  });
}

export function useDeleteSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: searchGateway.deleteHistory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: searchKeys.history() });
    },
  });
}

export function useClearSearchHistoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: searchGateway.clearHistory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: searchKeys.history() });
    },
  });
}
