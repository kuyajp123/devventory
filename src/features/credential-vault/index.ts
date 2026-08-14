export { CredentialVaultPage } from './pages/CredentialVaultPage';
export { CredentialVaultNavigationSync } from './components/CredentialVaultNavigationSync';
export {
  credentialVaultKeys,
  useCredentialSourcesQuery,
  useCredentialsQuery,
  useCredentialVaultStatusQuery,
} from './hooks/use-credential-vault';
export { credentialVaultGateway } from './services/credential-vault.gateway';
export {
  credentialKeySchema,
  PREDEFINED_CREDENTIAL_SOURCES,
} from './models/credential-vault';
export type {
  Credential,
  CredentialDraft,
  CredentialSource,
  VaultStatus,
} from './models/credential-vault';
