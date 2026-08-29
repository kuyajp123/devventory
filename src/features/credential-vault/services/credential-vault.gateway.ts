import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  credentialSchema,
  credentialSourceSchema,
  envSecretPreviewItemSchema,
  importEnvSecretsResultSchema,
  vaultStatusSchema,
  type CredentialDraft,
} from '../models/credential-vault';

export const credentialVaultGateway = {
  async status() {
    return vaultStatusSchema.parse(
      await invokeCommand<unknown>('get_credential_vault_status'),
    );
  },

  async unlock(password: string) {
    return vaultStatusSchema.parse(
      await invokeCommand<unknown>('unlock_credential_vault', {
        input: { password },
      }),
    );
  },

  async lock() {
    return vaultStatusSchema.parse(
      await invokeCommand<unknown>('lock_credential_vault'),
    );
  },

  async listSources() {
    return credentialSourceSchema
      .array()
      .parse(await invokeCommand<unknown>('list_credential_sources'));
  },

  async createSource(input: {
    definitionKey?: string;
    description?: string;
    iconSourcePath?: string;
    name: string;
    projectIds: string[];
  }) {
    return credentialSourceSchema.parse(
      await invokeCommand<unknown>('create_credential_source', { input }),
    );
  },

  async updateSource(input: {
    description?: string;
    iconSourcePath?: string;
    name: string;
    projectIds: string[];
    removeIcon: boolean;
    sourceId: string;
  }) {
    return credentialSourceSchema.parse(
      await invokeCommand<unknown>('update_credential_source', { input }),
    );
  },

  deleteSource(sourceId: string) {
    return invokeCommand<void>('delete_credential_source', {
      input: { sourceId },
    });
  },

  async listCredentials(sourceId?: string) {
    return credentialSchema.array().parse(
      await invokeCommand<unknown>('list_credentials', {
        input: { ...(sourceId ? { sourceId } : {}) },
      }),
    );
  },

  async createCredentials(sourceId: string, credentials: CredentialDraft[]) {
    return credentialSchema.array().parse(
      await invokeCommand<unknown>('create_credentials', {
        input: { credentials, sourceId },
      }),
    );
  },

  async updateCredential(input: {
    credentialId: string;
    environmentLinks: CredentialDraft['environmentLinks'];
    key: string;
    notes?: string;
    projectIds: string[];
  }) {
    return credentialSchema.parse(
      await invokeCommand<unknown>('update_credential', { input }),
    );
  },

  replaceSecret(credentialId: string, value: string) {
    return invokeCommand<void>('replace_credential_secret', {
      input: { credentialId, value },
    });
  },

  removeSecret(credentialId: string) {
    return invokeCommand<void>('remove_credential_secret', {
      input: { credentialId },
    });
  },

  revealSecret(credentialId: string) {
    return invokeCommand<string>('reveal_credential_secret', {
      input: { credentialId },
    });
  },

  deleteCredential(credentialId: string) {
    return invokeCommand<void>('delete_credential', {
      input: { credentialId },
    });
  },

  async previewEnvSecrets(projectId: string, relativePath: string) {
    return envSecretPreviewItemSchema.array().parse(
      await invokeCommand<unknown>('preview_env_file_secrets', {
        input: { projectId, relativePath },
      }),
    );
  },

  async importEnvFileToVault(input: {
    environmentId?: string;
    projectId: string;
    relativePath: string;
    selectedKeys: string[];
    sourceId?: string;
    sourceName?: string;
  }) {
    return importEnvSecretsResultSchema.parse(
      await invokeCommand<unknown>('import_env_file_to_vault', { input }),
    );
  },
};
