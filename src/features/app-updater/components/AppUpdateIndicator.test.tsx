import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AppUpdateIndicator } from './AppUpdateIndicator';
import { useAppUpdaterStore } from '../stores/app-updater.store';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';

vi.mock('../hooks/useAppUpdaterActions', () => ({
  useAppUpdaterActions: vi.fn(),
}));

describe('AppUpdateIndicator', () => {
  const openUpdateModalMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppUpdaterStore.getState().reset();
    vi.mocked(useAppUpdaterActions).mockReturnValue({
      checkForUpdates: vi.fn(),
      closeUpdateModal: vi.fn(),
      installAvailableUpdate: vi.fn(),
      loadCurrentVersion: vi.fn(),
      openUpdateModal: openUpdateModalMock,
    });
  });

  it('is hidden for idle status', () => {
    useAppUpdaterStore.getState().reset();
    const { container } = render(<AppUpdateIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden while checking', () => {
    useAppUpdaterStore.getState().beginCheck();
    const { container } = render(<AppUpdateIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden when up to date', () => {
    useAppUpdaterStore.getState().setUpToDate();
    const { container } = render(<AppUpdateIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden for error status', () => {
    useAppUpdaterStore.getState().setError('check', 'Test error');
    const { container } = render(<AppUpdateIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('is visible when an update is available', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    render(<AppUpdateIndicator />);
    expect(
      screen.getByRole('button', {
        name: /Update available: Devventory 0.1.1/i,
      }),
    ).toBeInTheDocument();
  });

  it('displays available version', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.2.0' }, false);
    render(<AppUpdateIndicator />);
    expect(screen.getByText('Update 0.2.0')).toBeInTheDocument();
  });

  it('opens update modal when clicked', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    render(<AppUpdateIndicator />);
    const button = screen.getByRole('button', {
      name: /Update available: Devventory 0.1.1/i,
    });
    button.click();
    expect(openUpdateModalMock).toHaveBeenCalledOnce();
  });

  it('displays downloading state correctly', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: undefined },
      event: 'Started',
    });
    render(<AppUpdateIndicator />);
    // Should show a disabled button with spinner when downloading
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('displays download percentage when known', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: 1000 },
      event: 'Started',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { chunkLength: 500 },
      event: 'Progress',
    });
    render(<AppUpdateIndicator />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('displays installing state correctly', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: 1000 },
      event: 'Started',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { chunkLength: 1000 },
      event: 'Progress',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({ event: 'Finished' });
    render(<AppUpdateIndicator />);
    expect(screen.getByText('Installing...')).toBeInTheDocument();
  });

  it('displays relaunching state correctly', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    useAppUpdaterStore.getState().setRelaunching();
    render(<AppUpdateIndicator />);
    expect(screen.getByText('Restarting...')).toBeInTheDocument();
  });

  it('cannot trigger duplicate actions while busy', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, false);
    useAppUpdaterStore.getState().setRelaunching();
    const { container } = render(<AppUpdateIndicator />);
    const button = container.querySelector('button');
    expect(button).toBeDisabled();
  });
});
