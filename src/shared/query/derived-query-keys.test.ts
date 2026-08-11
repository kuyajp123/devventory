import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  derivedQueryKeys,
  invalidateDerivedProjectQueries,
} from './derived-query-keys';

describe('derived project query invalidation', () => {
  it('refreshes the integrated environment and validation workspace once per prefix', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    await invalidateDerivedProjectQueries(queryClient, projectId);

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [
        derivedQueryKeys.search,
        derivedQueryKeys.environments(projectId),
        derivedQueryKeys.validation(projectId),
        derivedQueryKeys.dashboard(projectId),
      ],
    );
  });
});
