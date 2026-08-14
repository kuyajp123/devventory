import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { AppUpdaterSync } from './AppUpdaterSync';
import { useAppUpdaterStore } from '../stores/app-updater.store';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(),
}));

vi.mock('../hooks/useAppUpdaterActions', () => ({
  useAppUpdaterActions: vi.fn(),
}));

describe('AppUpdaterSync', () => {
  const isTauriMock = vi.mocked(isTauri);
  const useAppUpdaterActionsMock = vi.mocked(useAppUpdaterActions);

  beforeEach(() => {
    isTauriMock.mockReset();
    useAppUpdaterActionsMock.mockReset();
    useAppUpdaterStore.getState().reset();
  });

  it('does not run updater in browser/non-Tauri context', () => {
    isTauriMock.mockReturnValue(false);
    const loadCurrentVersionMock = vi.fn();
    const checkForUpdatesMock = vi.fn();
    useAppUpdaterActionsMock.mockReturnValue({
      loadCurrentVersion: loadCurrentVersionMock,
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      openUpdateModal: vi.fn(),
    });

    renderHook(() => AppUpdaterSync());

    expect(loadCurrentVersionMock).not.toHaveBeenCalled();
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
  });

  it('runs startup check in Tauri context', async () => {
    isTauriMock.mockReturnValue(true);
    const loadCurrentVersionMock = vi.fn().mockResolvedValue(undefined);
    const checkForUpdatesMock = vi.fn().mockResolvedValue(undefined);
    useAppUpdaterActionsMock.mockReturnValue({
      loadCurrentVersion: loadCurrentVersionMock,
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      openUpdateModal: vi.fn(),
    });

    renderHook(() => AppUpdaterSync());

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadCurrentVersionMock).toHaveBeenCalledOnce();
    expect(checkForUpdatesMock).toHaveBeenCalledWith('startup');
  });

  it('remains once-only under React StrictMode/remount behavior', async () => {
    isTauriMock.mockReturnValue(true);
    const loadCurrentVersionMock = vi.fn().mockResolvedValue(undefined);
    const checkForUpdatesMock = vi.fn().mockResolvedValue(undefined);
    useAppUpdaterActionsMock.mockReturnValue({
      loadCurrentVersion: loadCurrentVersionMock,
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      openUpdateModal: vi.fn(),
    });

    const { rerender } = renderHook(() => AppUpdaterSync());

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loadCurrentVersionMock).toHaveBeenCalledOnce();
    expect(checkForUpdatesMock).toHaveBeenCalledWith('startup');

    // Simulate StrictMode remount
    rerender();

    expect(loadCurrentVersionMock).toHaveBeenCalledOnce();
    expect(checkForUpdatesMock).toHaveBeenCalledWith('startup');
  });

  it('startup error is non-blocking', () => {
    isTauriMock.mockReturnValue(true);
    const loadCurrentVersionMock = vi
      .fn()
      .mockRejectedValue(new Error('Failed'));
    const checkForUpdatesMock = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));
    useAppUpdaterActionsMock.mockReturnValue({
      loadCurrentVersion: loadCurrentVersionMock,
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      openUpdateModal: vi.fn(),
    });

    expect(() => renderHook(() => AppUpdaterSync())).not.toThrow();
  });

  it('startup update availability does not automatically open modal', () => {
    isTauriMock.mockReturnValue(true);
    const loadCurrentVersionMock = vi.fn().mockResolvedValue(undefined);
    const checkForUpdatesMock = vi.fn().mockImplementation(async (source) => {
      if (source === 'startup') {
        const store = useAppUpdaterStore.getState();
        store.setAvailableUpdate(
          { currentVersion: '0.1.0', version: '0.1.1' },
          false, // Should not open modal for startup
        );
      }
    });
    useAppUpdaterActionsMock.mockReturnValue({
      loadCurrentVersion: loadCurrentVersionMock,
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      openUpdateModal: vi.fn(),
    });

    renderHook(() => AppUpdaterSync());

    // Give async operations time to complete
    return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(useAppUpdaterStore.getState().isModalOpen).toBe(false);
    });
  });
});
