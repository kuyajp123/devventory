import { create } from 'zustand';
import type {
  AppUpdateDownloadEvent,
  AppUpdateDownloadProgress,
  AppUpdateError,
  AppUpdateErrorStage,
  AppUpdateStatus,
  AvailableAppUpdate,
} from '../types/app-update.types';

interface AppUpdaterState {
  availableUpdate: AvailableAppUpdate | null;
  beginCheck: () => boolean;
  beginStartupCheck: () => boolean;
  closeModal: () => boolean;
  currentVersion: string | null;
  currentVersionLoadAttempted: boolean;
  download: AppUpdateDownloadProgress;
  error: AppUpdateError | null;
  isModalOpen: boolean;
  lastCheckedAt: string | null;
  openModal: () => boolean;
  recordDownloadEvent: (event: AppUpdateDownloadEvent) => void;
  reset: () => void;
  setAvailableUpdate: (update: AvailableAppUpdate, openModal: boolean) => void;
  setCurrentVersion: (version: string) => void;
  setCurrentVersionLoadAttempted: () => void;
  setError: (stage: AppUpdateErrorStage, message: string) => void;
  setInstalling: () => void;
  setRelaunching: () => void;
  setUpToDate: () => void;
  startupCheckStarted: boolean;
  status: AppUpdateStatus;
}

const emptyDownloadProgress: AppUpdateDownloadProgress = {
  downloadedBytes: 0,
  percentage: null,
  totalBytes: null,
};

const initialState = {
  availableUpdate: null,
  currentVersion: null,
  currentVersionLoadAttempted: false,
  download: emptyDownloadProgress,
  error: null,
  isModalOpen: false,
  lastCheckedAt: null,
  startupCheckStarted: false,
  status: 'idle',
} satisfies Pick<
  AppUpdaterState,
  | 'availableUpdate'
  | 'currentVersion'
  | 'currentVersionLoadAttempted'
  | 'download'
  | 'error'
  | 'isModalOpen'
  | 'lastCheckedAt'
  | 'startupCheckStarted'
  | 'status'
>;

function isBusy(status: AppUpdateStatus) {
  return (
    status === 'checking' ||
    status === 'downloading' ||
    status === 'installing' ||
    status === 'relaunching'
  );
}

export const useAppUpdaterStore = create<AppUpdaterState>((set, get) => ({
  ...initialState,

  beginCheck: () => {
    if (isBusy(get().status)) return false;

    set({
      download: { ...emptyDownloadProgress },
      error: null,
      status: 'checking',
    });
    return true;
  },

  beginStartupCheck: () => {
    if (get().startupCheckStarted) return false;
    set({ startupCheckStarted: true });
    return true;
  },

  closeModal: () => {
    if (isBusy(get().status)) return false;
    set({ isModalOpen: false });
    return true;
  },

  openModal: () => {
    const { availableUpdate, status } = get();
    if (!availableUpdate || isBusy(status)) return false;
    set({ isModalOpen: true });
    return true;
  },

  recordDownloadEvent: (event) => {
    if (event.event === 'Started') {
      const totalBytes = event.data.contentLength ?? null;
      set({
        download: {
          downloadedBytes: 0,
          percentage: totalBytes === null ? null : 0,
          totalBytes,
        },
        status: 'downloading',
      });
      return;
    }

    if (event.event === 'Progress') {
      set((state) => {
        const downloadedBytes =
          state.download.downloadedBytes + event.data.chunkLength;
        const totalBytes = state.download.totalBytes;
        const percentage =
          totalBytes === null || totalBytes <= 0
            ? null
            : Math.min(100, Math.max(0, (downloadedBytes / totalBytes) * 100));

        return {
          download: {
            downloadedBytes,
            percentage,
            totalBytes,
          },
          status: 'downloading',
        };
      });
      return;
    }

    set((state) => ({
      download: {
        ...state.download,
        percentage:
          state.download.totalBytes === null
            ? null
            : Math.max(100, state.download.percentage ?? 0),
      },
      status: 'installing',
    }));
  },

  reset: () => set({ ...initialState, download: { ...emptyDownloadProgress } }),

  setAvailableUpdate: (availableUpdate, isModalOpen) =>
    set({
      availableUpdate,
      currentVersion: availableUpdate.currentVersion,
      download: { ...emptyDownloadProgress },
      error: null,
      isModalOpen,
      lastCheckedAt: new Date().toISOString(),
      status: 'available',
    }),

  setCurrentVersion: (currentVersion) => set({ currentVersion }),

  setCurrentVersionLoadAttempted: () =>
    set({ currentVersionLoadAttempted: true }),

  setError: (stage, message) =>
    set({
      error: { message, stage },
      status: 'error',
    }),

  setInstalling: () => {
    if (get().status === 'error') return;
    set({ status: 'installing' });
  },

  setRelaunching: () => {
    if (get().status === 'error') return;
    set({ status: 'relaunching' });
  },

  setUpToDate: () =>
    set({
      availableUpdate: null,
      download: { ...emptyDownloadProgress },
      error: null,
      lastCheckedAt: new Date().toISOString(),
      status: 'upToDate',
    }),
}));

export function isAppUpdateBusy(status: AppUpdateStatus) {
  return isBusy(status);
}
