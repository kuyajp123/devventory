import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AboutUpdatesSettingsSection } from './AboutUpdatesSettingsSection';
import { useAppUpdaterStore } from '@/features/app-updater/stores/app-updater.store';
import { useAppUpdaterActions } from '@/features/app-updater/hooks/useAppUpdaterActions';

vi.mock('@/features/app-updater/hooks/useAppUpdaterActions', () => ({
  useAppUpdaterActions: vi.fn(),
}));

describe('AboutUpdatesSettingsSection', () => {
  const checkForUpdatesMock = vi.fn();
  const openUpdateModalMock = vi.fn();
  const loadCurrentVersionMock = vi.fn();

  const installAvailableUpdateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppUpdaterStore.getState().reset();
    vi.mocked(useAppUpdaterActions).mockReturnValue({
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: installAvailableUpdateMock,
      loadCurrentVersion: loadCurrentVersionMock,
      openUpdateModal: openUpdateModalMock,
    });
  });

  it('displays current version when available', () => {
    useAppUpdaterStore.getState().setCurrentVersion('0.1.0');
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText('Version 0.1.0')).toBeInTheDocument();
  });

  it('displays placeholder when version is not yet loaded', () => {
    useAppUpdaterStore.getState().reset();
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText('Version —')).toBeInTheDocument();
  });

  it('loads current version if not already available', () => {
    useAppUpdaterStore.getState().reset();
    render(<AboutUpdatesSettingsSection />);
    expect(loadCurrentVersionMock).toHaveBeenCalledOnce();
  });

  it('does not reload version after failed attempt', () => {
    useAppUpdaterStore.getState().reset();
    loadCurrentVersionMock.mockRejectedValue(new Error('Failed'));
    render(<AboutUpdatesSettingsSection />);
    // First attempt happens
    expect(loadCurrentVersionMock).toHaveBeenCalledOnce();
    // Mark load as attempted
    useAppUpdaterStore.getState().setCurrentVersionLoadAttempted();
    // Should not attempt again on re-render
    loadCurrentVersionMock.mockClear();
    render(<AboutUpdatesSettingsSection />);
    expect(loadCurrentVersionMock).not.toHaveBeenCalled();
  });

  it('does not reload version if already available', () => {
    useAppUpdaterStore.getState().setCurrentVersion('0.1.0');
    render(<AboutUpdatesSettingsSection />);
    expect(loadCurrentVersionMock).not.toHaveBeenCalled();
  });

  it('manual Check for Updates works', () => {
    render(<AboutUpdatesSettingsSection />);
    const checkButton = screen.getByRole('button', {
      name: 'Check for Updates',
    });
    fireEvent.click(checkButton);
    expect(checkForUpdatesMock).toHaveBeenCalledWith('manual');
  });

  it('displays up-to-date state', () => {
    useAppUpdaterStore.getState().setUpToDate();
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText("You're up to date.")).toBeInTheDocument();
  });

  it('displays available-update state with version details and release notes', () => {
    useAppUpdaterStore.getState().setCurrentVersion('0.1.0');
    useAppUpdaterStore.getState().setAvailableUpdate(
      {
        body: 'Added new features and bug fixes',
        currentVersion: '0.1.0',
        date: '2026-08-15T00:00:00.000Z',
        version: '0.1.1',
      },
      false,
    );
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText('Version 0.1.1 is available')).toBeInTheDocument();
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(
      screen.getByText('Added new features and bug fixes'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Published/i)).toBeInTheDocument();
  });

  it('cleans raw markdown release header and displays fallback when no notes body exists', () => {
    useAppUpdaterStore.getState().setAvailableUpdate(
      {
        body: '## [1.1.0](https://github.com/kuyajp123/devventory/compare/v1.0.1...v1.1.0) (2026-08-16)',
        currentVersion: '0.1.0',
        date: '2026-08-16T00:00:00.000Z',
        version: '1.1.0',
      },
      false,
    );
    render(<AboutUpdatesSettingsSection />);
    expect(
      screen.getByText('Includes bug fixes and performance improvements.'),
    ).toBeInTheDocument();
  });

  it('clicking Update Now triggers installAvailableUpdate directly', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    render(<AboutUpdatesSettingsSection />);
    const updateNowButton = screen.getByRole('button', {
      name: 'Update Now',
    });
    fireEvent.click(updateNowButton);
    expect(installAvailableUpdateMock).toHaveBeenCalledOnce();
  });

  it('displays error state', () => {
    useAppUpdaterStore.getState().setError('check', 'Network error');
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText('Unable to check for updates')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('last checked state renders safely', () => {
    useAppUpdaterStore.getState().setUpToDate();
    render(<AboutUpdatesSettingsSection />);
    expect(screen.getByText(/Last checked/i)).toBeInTheDocument();
  });

  it('last checked handles null safely', () => {
    useAppUpdaterStore.getState().reset();
    render(<AboutUpdatesSettingsSection />);
    expect(screen.queryByText(/Last checked/i)).not.toBeInTheDocument();
  });

  it('Check button is disabled while busy', () => {
    useAppUpdaterStore.getState().beginCheck();
    render(<AboutUpdatesSettingsSection />);
    const checkButton = screen.getByRole('button', {
      name: 'Checking...',
    });
    expect(checkButton).toBeDisabled();
  });
});
