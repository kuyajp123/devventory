import { beforeEach, describe, expect, it } from 'vitest';
import { credentialVaultViewStore } from './credential-vault-view.store';

describe('credentialVaultViewStore', () => {
  beforeEach(() => {
    credentialVaultViewStore.clear();
  });

  it('returns default state when uninitialized', () => {
    const state = credentialVaultViewStore.getViewState();
    expect(state).toEqual({
      scrollPosition: { scrollLeft: 0, scrollTop: 0 },
      selectedCredentialId: null,
      selectedSourceId: null,
    });
  });

  it('persists selected credential id', () => {
    credentialVaultViewStore.setSelectedCredentialId('cred-123');
    expect(credentialVaultViewStore.getViewState().selectedCredentialId).toBe(
      'cred-123',
    );
  });

  it('persists scroll position', () => {
    credentialVaultViewStore.setScrollPosition({
      scrollLeft: 50,
      scrollTop: 300,
    });
    expect(credentialVaultViewStore.getViewState().scrollPosition).toEqual({
      scrollLeft: 50,
      scrollTop: 300,
    });
  });

  it('persists selected source id', () => {
    credentialVaultViewStore.setSelectedSourceId('source-abc');
    expect(credentialVaultViewStore.getViewState().selectedSourceId).toBe(
      'source-abc',
    );
  });
});
