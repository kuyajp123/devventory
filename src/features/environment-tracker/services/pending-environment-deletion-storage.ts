import type { Environment } from '../models/environment';

const STORAGE_KEY = 'devventory:pending-environment-deletions';

export interface PersistedPendingDeletion {
  environment: Environment;
  environmentId: string;
  projectId: string;
  startedAtMs: number;
}

export function getPersistedPendingDeletions(): PersistedPendingDeletion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedPendingDeletion[];
  } catch {
    return [];
  }
}

export function savePendingDeletionRecord(
  projectId: string,
  environment: Environment,
): void {
  try {
    const current = getPersistedPendingDeletions().filter(
      (item) =>
        !(
          item.projectId === projectId && item.environmentId === environment.id
        ),
    );
    const updated: PersistedPendingDeletion[] = [
      ...current,
      {
        environment,
        environmentId: environment.id,
        projectId,
        startedAtMs: Date.now(),
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function removePendingDeletionRecord(
  projectId: string,
  environmentId: string,
): void {
  try {
    const updated = getPersistedPendingDeletions().filter(
      (item) =>
        !(item.projectId === projectId && item.environmentId === environmentId),
    );
    if (updated.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAllPendingDeletionRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
