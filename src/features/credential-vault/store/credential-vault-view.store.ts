export interface CredentialVaultScrollPosition {
  scrollLeft: number;
  scrollTop: number;
}

export interface CredentialVaultViewState {
  scrollPosition: CredentialVaultScrollPosition;
  selectedCredentialId: string | null;
  selectedSourceId: string | null;
}

const defaultVaultState: CredentialVaultViewState = {
  scrollPosition: { scrollLeft: 0, scrollTop: 0 },
  selectedCredentialId: null,
  selectedSourceId: null,
};

const STORAGE_KEY = 'devventory:vault:view';

function loadFromSessionStorage(): CredentialVaultViewState | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CredentialVaultViewState>;
    return {
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
      selectedCredentialId:
        typeof parsed.selectedCredentialId === 'string'
          ? parsed.selectedCredentialId
          : null,
      selectedSourceId:
        typeof parsed.selectedSourceId === 'string'
          ? parsed.selectedSourceId
          : null,
    };
  } catch {
    return null;
  }
}

function saveToSessionStorage(state: CredentialVaultViewState): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export class CredentialVaultViewStore {
  private state: CredentialVaultViewState | null = null;

  public getViewState(): CredentialVaultViewState {
    if (this.state) return this.state;
    const fromStorage = loadFromSessionStorage();
    if (fromStorage) {
      this.state = fromStorage;
      return fromStorage;
    }
    this.state = { ...defaultVaultState };
    return this.state;
  }

  public setSelectedCredentialId(selectedCredentialId: string | null): void {
    const current = this.getViewState();
    this.state = {
      ...current,
      selectedCredentialId,
    };
    saveToSessionStorage(this.state);
  }

  public setSelectedSourceId(selectedSourceId: string | null): void {
    const current = this.getViewState();
    this.state = {
      ...current,
      selectedSourceId,
    };
    saveToSessionStorage(this.state);
  }

  public setScrollPosition(
    scrollPosition: CredentialVaultScrollPosition,
  ): void {
    const current = this.getViewState();
    this.state = {
      ...current,
      scrollPosition: {
        scrollLeft: Math.max(0, scrollPosition.scrollLeft),
        scrollTop: Math.max(0, scrollPosition.scrollTop),
      },
    };
    saveToSessionStorage(this.state);
  }

  public clear(): void {
    this.state = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

export const credentialVaultViewStore = new CredentialVaultViewStore();
