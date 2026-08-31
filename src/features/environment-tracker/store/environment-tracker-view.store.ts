export interface EnvironmentTrackerScrollPosition {
  scrollLeft: number;
  scrollTop: number;
}

export interface EnvironmentTrackerSelectedCell {
  environmentId: string;
  keyName: string;
  selectedSourcePath?: string;
}

export interface EnvironmentTrackerProjectViewState {
  page: number;
  scrollPosition: EnvironmentTrackerScrollPosition;
  search: string;
  selectedCell: EnvironmentTrackerSelectedCell | null;
  selectedEnvironmentId: string | null;
  view: 'compare' | 'inspect';
}

const defaultProjectState: EnvironmentTrackerProjectViewState = {
  page: 1,
  scrollPosition: { scrollLeft: 0, scrollTop: 0 },
  search: '',
  selectedCell: null,
  selectedEnvironmentId: null,
  view: 'compare',
};

const STORAGE_KEY_PREFIX = 'devventory:env-tracker:view:';

function loadFromSessionStorage(
  projectId: string | null,
): EnvironmentTrackerProjectViewState | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(
      `${STORAGE_KEY_PREFIX}${projectId ?? '__default__'}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(
      raw,
    ) as Partial<EnvironmentTrackerProjectViewState>;
    return {
      page:
        typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1,
      scrollPosition: {
        scrollLeft:
          typeof parsed.scrollPosition?.scrollLeft === 'number'
            ? Math.max(0, parsed.scrollPosition.scrollLeft)
            : 0,
        scrollTop:
          typeof parsed.scrollPosition?.scrollTop === 'number'
            ? Math.max(0, parsed.scrollPosition.scrollTop)
            : 0,
      },
      search: typeof parsed.search === 'string' ? parsed.search : '',
      selectedCell:
        parsed.selectedCell &&
        typeof parsed.selectedCell.keyName === 'string' &&
        typeof parsed.selectedCell.environmentId === 'string'
          ? {
              environmentId: parsed.selectedCell.environmentId,
              keyName: parsed.selectedCell.keyName,
              selectedSourcePath:
                typeof parsed.selectedCell.selectedSourcePath === 'string'
                  ? parsed.selectedCell.selectedSourcePath
                  : undefined,
            }
          : null,
      selectedEnvironmentId:
        typeof parsed.selectedEnvironmentId === 'string'
          ? parsed.selectedEnvironmentId
          : null,
      view: parsed.view === 'inspect' ? 'inspect' : 'compare',
    };
  } catch {
    return null;
  }
}

function saveToSessionStorage(
  projectId: string | null,
  state: EnvironmentTrackerProjectViewState,
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${projectId ?? '__default__'}`,
      JSON.stringify(state),
    );
  } catch {
    // ignore quota/security errors
  }
}

function removeFromSessionStorage(projectId: string | null): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(
      `${STORAGE_KEY_PREFIX}${projectId ?? '__default__'}`,
    );
  } catch {
    // ignore
  }
}

export class EnvironmentTrackerViewStore {
  private stateByProject = new Map<
    string,
    EnvironmentTrackerProjectViewState
  >();

  private getKey(projectId: string | null): string {
    return projectId ?? '__default__';
  }

  public getViewState(
    projectId: string | null,
  ): EnvironmentTrackerProjectViewState {
    const key = this.getKey(projectId);
    const existing = this.stateByProject.get(key);
    if (existing) {
      return existing;
    }
    const fromStorage = loadFromSessionStorage(projectId);
    if (fromStorage) {
      this.stateByProject.set(key, fromStorage);
      return fromStorage;
    }
    const initial = { ...defaultProjectState };
    this.stateByProject.set(key, initial);
    return initial;
  }

  public setPage(projectId: string | null, page: number): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      page: Math.max(1, page),
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public setScrollPosition(
    projectId: string | null,
    scrollPosition: EnvironmentTrackerScrollPosition,
  ): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      scrollPosition: {
        scrollLeft: Math.max(0, scrollPosition.scrollLeft),
        scrollTop: Math.max(0, scrollPosition.scrollTop),
      },
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public setSearch(projectId: string | null, search: string): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      search,
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public setSelectedCell(
    projectId: string | null,
    selectedCell: EnvironmentTrackerSelectedCell | null,
  ): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      selectedCell,
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public setSelectedEnvironmentId(
    projectId: string | null,
    selectedEnvironmentId: string | null,
  ): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      selectedEnvironmentId,
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public setView(projectId: string | null, view: 'compare' | 'inspect'): void {
    const current = this.getViewState(projectId);
    const next = {
      ...current,
      view,
    };
    this.stateByProject.set(this.getKey(projectId), next);
    saveToSessionStorage(projectId, next);
  }

  public resetProjectState(projectId: string | null): void {
    this.stateByProject.delete(this.getKey(projectId));
    removeFromSessionStorage(projectId);
  }

  public clear(): void {
    this.stateByProject.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
  }
}

export const environmentTrackerViewStore = new EnvironmentTrackerViewStore();
