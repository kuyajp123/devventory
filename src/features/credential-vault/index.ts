export { CredentialVaultPage } from './pages/CredentialVaultPage';
export { CredentialVaultNavigationSync } from './components/CredentialVaultNavigationSync';
export { VaultUnlockDialog } from './components/VaultUnlockDialog';
export {
  credentialVaultKeys,
  useCredentialSourcesQuery,
  useCredentialsQuery,
  useCredentialVaultStatusQuery,
  useUnlockCredentialVaultMutation,
} from './hooks/use-credential-vault';
export { credentialVaultGateway } from './services/credential-vault.gateway';
export {
  credentialKeySchema,
  PREDEFINED_CREDENTIAL_SOURCES,
} from './models/credential-vault';
export { credentialVaultViewStore } from './store/credential-vault-view.store';
export type {
  CredentialVaultScrollPosition,
  CredentialVaultViewState,
} from './store/credential-vault-view.store';
export type {
  Credential,
  CredentialDraft,
  CredentialSource,
  VaultStatus,
} from './models/credential-vault';
