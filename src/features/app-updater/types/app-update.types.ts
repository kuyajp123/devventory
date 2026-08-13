export interface AvailableAppUpdate {
  currentVersion: string;
  version: string;
  body?: string;
  date?: string;
}

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'relaunching'
  | 'error';

export type AppUpdateErrorStage =
  'version' | 'check' | 'download' | 'install' | 'relaunch';

export interface AppUpdateError {
  message: string;
  stage: AppUpdateErrorStage;
}

export interface AppUpdateDownloadProgress {
  downloadedBytes: number;
  percentage: number | null;
  totalBytes: number | null;
}

export type AppUpdateDownloadEvent =
  | {
      data: { contentLength?: number };
      event: 'Started';
    }
  | {
      data: { chunkLength: number };
      event: 'Progress';
    }
  | { event: 'Finished' };

export type AppUpdateInstallOutcome =
  | { kind: 'no-update' }
  | { kind: 'version-changed'; update: AvailableAppUpdate }
  | { kind: 'installed' };

export type UpdateCheckSource = 'startup' | 'manual' | 'preInstall';
