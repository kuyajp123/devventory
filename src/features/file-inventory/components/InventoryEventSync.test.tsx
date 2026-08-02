import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import type { Event } from '@tauri-apps/api/event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryEventSync } from './InventoryEventSync';

const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }));

vi.mock('@tauri-apps/api/event', () => ({ listen: eventMocks.listen }));

describe('InventoryEventSync', () => {
  beforeEach(() => {
    eventMocks.listen.mockResolvedValue(vi.fn());
  });

  it('invalidates only the affected project after a valid native event', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryEventSync />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(eventMocks.listen).toHaveBeenCalledOnce());
    const listener = eventMocks.listen.mock.calls[0][1] as (
      event: Event<unknown>,
    ) => void;

    act(() => {
      listener({
        event: 'inventory://changed',
        id: 1,
        payload: {
          projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
          scanId: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
          status: 'completed',
        },
      });
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['file-inventory', '30af17bd-2dd6-4b89-a5e7-8517191815a7'],
    });
  });

  it('ignores malformed native events', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <InventoryEventSync />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(eventMocks.listen).toHaveBeenCalledOnce());
    const listener = eventMocks.listen.mock.calls[0][1] as (
      event: Event<unknown>,
    ) => void;

    act(() => listener({ event: 'inventory://changed', id: 1, payload: {} }));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
