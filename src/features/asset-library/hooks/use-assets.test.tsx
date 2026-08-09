import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fileInventoryProjectKeys } from '@/shared/query/file-inventory-query-keys';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { assetKeys, useImportAssetMutation } from './use-assets';

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    import: vi.fn(),
  },
}));

describe('useImportAssetMutation', () => {
  it('invalidates both asset and file-inventory data after indexing', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    vi.mocked(assetLibraryGateway.import).mockResolvedValue({
      asset: null,
      duplicate: null,
      status: 'cancelled',
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useImportAssetMutation(projectId), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({
        collision: 'cancel',
        destination: 'assets',
        favorite: false,
        sourcePath: 'C:\\external\\logo.png',
        tags: [],
      }),
    );

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: assetKeys.project(projectId),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: fileInventoryProjectKeys.project(projectId),
    });
  });
});
