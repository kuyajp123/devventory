import { beforeEach, describe, expect, it } from 'vitest';
import { useAppUpdaterStore } from './app-updater.store';

const availableUpdate = {
  body: 'Safe plain-text release notes.',
  currentVersion: '0.1.0',
  date: '2026-08-13T00:00:00Z',
  version: '0.1.1',
};

describe('app updater store', () => {
  beforeEach(() => {
    useAppUpdaterStore.getState().reset();
  });

  it('transitions a check from idle to available and preserves metadata when later is chosen', () => {
    const store = useAppUpdaterStore.getState();

    expect(store.beginCheck()).toBe(true);
    expect(useAppUpdaterStore.getState().status).toBe('checking');

    useAppUpdaterStore.getState().setAvailableUpdate(availableUpdate, true);
    expect(useAppUpdaterStore.getState()).toMatchObject({
      availableUpdate,
      isModalOpen: true,
      status: 'available',
    });

    useAppUpdaterStore.getState().closeModal();
    expect(useAppUpdaterStore.getState()).toMatchObject({
      availableUpdate,
      isModalOpen: false,
      status: 'available',
    });
  });

  it('maps updater progress and prevents duplicate busy work', () => {
    const store = useAppUpdaterStore.getState();
    store.setAvailableUpdate(availableUpdate, true);

    expect(store.beginCheck()).toBe(true);
    expect(store.beginCheck()).toBe(false);

    store.recordDownloadEvent({
      data: { contentLength: 200 },
      event: 'Started',
    });
    store.recordDownloadEvent({ data: { chunkLength: 50 }, event: 'Progress' });
    store.recordDownloadEvent({
      data: { chunkLength: 200 },
      event: 'Progress',
    });

    expect(useAppUpdaterStore.getState()).toMatchObject({
      download: {
        downloadedBytes: 250,
        percentage: 100,
        totalBytes: 200,
      },
      status: 'downloading',
    });

    store.recordDownloadEvent({ event: 'Finished' });
    expect(useAppUpdaterStore.getState().status).toBe('installing');
    expect(useAppUpdaterStore.getState().closeModal()).toBe(false);
  });

  it('clears stale state for a new check and records actionable errors', () => {
    const store = useAppUpdaterStore.getState();
    store.setAvailableUpdate(availableUpdate, true);
    store.recordDownloadEvent({
      data: { contentLength: undefined },
      event: 'Started',
    });
    store.setError('download', 'Unable to download the update.');

    expect(useAppUpdaterStore.getState()).toMatchObject({
      error: {
        message: 'Unable to download the update.',
        stage: 'download',
      },
      status: 'error',
    });

    expect(store.beginCheck()).toBe(true);
    expect(useAppUpdaterStore.getState()).toMatchObject({
      download: {
        downloadedBytes: 0,
        percentage: null,
        totalBytes: null,
      },
      error: null,
      status: 'checking',
    });
  });

  it('marks a new session startup check exactly once', () => {
    expect(useAppUpdaterStore.getState().beginStartupCheck()).toBe(true);
    expect(useAppUpdaterStore.getState().beginStartupCheck()).toBe(false);

    useAppUpdaterStore.getState().reset();
    expect(useAppUpdaterStore.getState().beginStartupCheck()).toBe(true);
  });
});
