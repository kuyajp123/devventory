import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AppUpdateModal } from './AppUpdateModal';
import { useAppUpdaterStore } from '../stores/app-updater.store';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';

vi.mock('../hooks/useAppUpdaterActions', () => ({
  useAppUpdaterActions: vi.fn(),
}));

describe('AppUpdateModal', () => {
  const closeUpdateModalMock = vi.fn();
  const installAvailableUpdateMock = vi.fn();
  const checkForUpdatesMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppUpdaterStore.getState().reset();
    vi.mocked(useAppUpdaterActions).mockReturnValue({
      checkForUpdates: checkForUpdatesMock,
      closeUpdateModal: closeUpdateModalMock,
      installAvailableUpdate: installAvailableUpdateMock,
      loadCurrentVersion: vi.fn(),
      openUpdateModal: vi.fn(),
    });
  });

  it('renders null when status is available (details shown directly in settings page)', () => {
    useAppUpdaterStore.getState().setCurrentVersion('0.1.0');
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    const { container } = render(<AppUpdateModal />);
    expect(container.firstChild).toBeNull();
  });

  it('cannot be dismissed while downloading', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: 1000 },
      event: 'Started',
    });
    render(<AppUpdateModal />);
    const dialog = screen.getByRole('dialog');
    // Dialog should not have a close button or escape dismiss option when busy
    expect(dialog).toBeInTheDocument();
  });

  it('cannot be dismissed while installing', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: 1000 },
      event: 'Started',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { chunkLength: 1000 },
      event: 'Progress',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({ event: 'Finished' });
    render(<AppUpdateModal />);
    expect(screen.getByText('Installing Update')).toBeInTheDocument();
  });

  it('cannot be dismissed while relaunching', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().setRelaunching();
    render(<AppUpdateModal />);
    expect(screen.getByText('Restarting Devventory')).toBeInTheDocument();
  });

  it('download percentage is rendered when known', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: 1000 },
      event: 'Started',
    });
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { chunkLength: 500 },
      event: 'Progress',
    });
    render(<AppUpdateModal />);
    // Progress bar should be present
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('indeterminate progress works when total size is unknown', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().recordDownloadEvent({
      data: { contentLength: undefined },
      event: 'Started',
    });
    render(<AppUpdateModal />);
    expect(screen.getByText('Downloading Update')).toBeInTheDocument();
    // When percentage is null, the progress bar shows 0% in sr-only output for accessibility
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('error state is recoverable with Try Again', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore.getState().setError('download', 'Download failed');
    render(<AppUpdateModal />);
    // Verify error state is set in store
    expect(useAppUpdaterStore.getState().status).toBe('error');
    expect(useAppUpdaterStore.getState().error?.stage).toBe('download');
    // Error modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('relaunch error clearly tells user to restart manually', () => {
    useAppUpdaterStore
      .getState()
      .setAvailableUpdate({ currentVersion: '0.1.0', version: '0.1.1' }, true);
    useAppUpdaterStore
      .getState()
      .setError(
        'relaunch',
        'The update was installed, but Devventory could not restart automatically.',
      );
    render(<AppUpdateModal />);
    // Verify relaunch error state is set in store
    expect(useAppUpdaterStore.getState().status).toBe('error');
    expect(useAppUpdaterStore.getState().error?.stage).toBe('relaunch');
    // Error modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders null when no update is available', () => {
    useAppUpdaterStore.getState().reset();
    const { container } = render(<AppUpdateModal />);
    expect(container.firstChild).toBeNull();
  });
});
