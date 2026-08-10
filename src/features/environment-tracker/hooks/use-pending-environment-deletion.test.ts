import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '../models/environment';
import {
  clearAllPendingDeletionRecords,
  getPersistedPendingDeletions,
  savePendingDeletionRecord,
} from '../services/pending-environment-deletion-storage';
import { usePendingEnvironmentDeletion } from './use-pending-environment-deletion';

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('./use-environments', () => ({
  useDeleteEnvironmentMutation: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

const sampleEnvironment: Environment = {
  createdAt: '2026-08-08T00:00:00Z',
  description: 'Production config',
  id: 'env-prod-123',
  name: 'production',
  projectId: 'proj-1',
  sortOrder: 0,
  updatedAt: '2026-08-08T00:00:00Z',
};

describe('usePendingEnvironmentDeletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllPendingDeletionRecords();
    mockMutateAsync.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearAllPendingDeletionRecords();
    vi.useRealTimers();
  });

  it('starts pending deletion with 5 seconds remaining and optimistically exposes pending ID', () => {
    const { result } = renderHook(() =>
      usePendingEnvironmentDeletion('proj-1'),
    );

    act(() => {
      result.current.startPendingDeletion(sampleEnvironment);
    });

    expect(result.current.isPendingDelete).toBe(true);
    expect(result.current.pendingEnvironmentId).toBe('env-prod-123');
    expect(result.current.pending?.secondsRemaining).toBe(5);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(getPersistedPendingDeletions()).toHaveLength(1);
  });

  it('decrements secondsRemaining over time and finalizes backend deletion at 5s timeout', async () => {
    const { result } = renderHook(() =>
      usePendingEnvironmentDeletion('proj-1'),
    );

    act(() => {
      result.current.startPendingDeletion(sampleEnvironment);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.pending?.secondsRemaining).toBe(3);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith('env-prod-123');
    expect(result.current.isPendingDelete).toBe(false);
    expect(getPersistedPendingDeletions()).toHaveLength(0);
  });

  it('cancels backend deletion when undo is clicked before 5s timeout', () => {
    const { result } = renderHook(() =>
      usePendingEnvironmentDeletion('proj-1'),
    );

    act(() => {
      result.current.startPendingDeletion(sampleEnvironment);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      result.current.undoPendingDeletion();
    });

    expect(result.current.isPendingDelete).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(getPersistedPendingDeletions()).toHaveLength(0);
  });

  it('restores environment when backend deletion fails after timeout', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() =>
      usePendingEnvironmentDeletion('proj-1'),
    );

    act(() => {
      result.current.startPendingDeletion(sampleEnvironment);
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith('env-prod-123');
    expect(result.current.isPendingDelete).toBe(false);
  });

  it('immediately finalizes leftover pending deletions from prior session on startup without showing Undo', async () => {
    // Simulate app closing before timer expired: record leftover in localStorage
    savePendingDeletionRecord('proj-1', sampleEnvironment);
    expect(getPersistedPendingDeletions()).toHaveLength(1);

    const { result } = renderHook(() =>
      usePendingEnvironmentDeletion('proj-1'),
    );

    await act(async () => {
      // Allow startup effect to resolve
    });

    expect(mockMutateAsync).toHaveBeenCalledWith('env-prod-123');
    expect(result.current.isPendingDelete).toBe(false);
    expect(getPersistedPendingDeletions()).toHaveLength(0);
  });
});
