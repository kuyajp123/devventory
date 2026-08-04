import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentEventSync } from './EnvironmentEventSync';

const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));

describe('EnvironmentEventSync', () => {
  beforeEach(() => listen.mockReset());

  it('invalidates only the changed project environment queries', async () => {
    let callback: ((event: { payload: unknown }) => void) | undefined;
    listen.mockImplementation((_name, handler) => {
      callback = handler;
      return Promise.resolve(vi.fn());
    });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <EnvironmentEventSync />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(listen).toHaveBeenCalled());
    callback?.({
      payload: {
        projectId: '9f5d03dc-34bf-4cc6-a2df-a186ffdd601b',
        sourcesRefreshed: 1,
      },
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['environment-tracker', '9f5d03dc-34bf-4cc6-a2df-a186ffdd601b'],
    });
  });
});
