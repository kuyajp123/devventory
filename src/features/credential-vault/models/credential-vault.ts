import { z } from 'zod';

export const vaultStatusSchema = z.object({
  isConfigured: z.boolean(),
  isUnlocked: z.boolean(),
});
export type VaultStatus = z.infer<typeof vaultStatusSchema>;

export const credentialSourceSchema = z.object({
  createdAt: z.string().min(1),
  credentialCount: z.number().int().nonnegative(),
  definitionKey: z.string().nullable(),
  description: z.string().nullable(),
  iconPath: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  projectIds: z.array(z.string().uuid()),
  updatedAt: z.string().min(1),
});
export type CredentialSource = z.infer<typeof credentialSourceSchema>;

export const credentialEnvironmentLinkSchema = z.object({
  environmentId: z.string().uuid(),
  projectId: z.string().uuid(),
});
export type CredentialEnvironmentLink = z.infer<
  typeof credentialEnvironmentLinkSchema
>;

export const credentialSchema = z.object({
  createdAt: z.string().min(1),
  environmentLinks: z.array(credentialEnvironmentLinkSchema),
  hasValue: z.boolean(),
  id: z.string().uuid(),
  key: z.string().min(1).max(255),
  normalizedKey: z.string().min(1).max(255),
  notes: z.string().nullable(),
  projectIds: z.array(z.string().uuid()),
  sourceId: z.string().uuid(),
  updatedAt: z.string().min(1),
});
export type Credential = z.infer<typeof credentialSchema>;

export interface CredentialDraft {
  environmentLinks: CredentialEnvironmentLink[];
  key: string;
  notes?: string;
  projectIds: string[];
  value?: string;
}

export const credentialKeySchema = z
  .string()
  .trim()
  .min(1, 'Enter a credential key.')
  .max(255, 'Use 255 characters or fewer.')
  .refine(
    (value) => !Array.from(value).some(isControlCharacter),
    'Control characters are not allowed in credential keys.',
  );

function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
}

export const credentialSourceNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a source name.')
  .max(120, 'Use 120 characters or fewer.');

export const MAX_CREDENTIAL_VALUE_BYTES = 1024 * 1024;

export interface PredefinedCredentialSource {
  defaultName: string;
  description: string;
  key: string;
  logoFileName: string;
}

export const PREDEFINED_CREDENTIAL_SOURCES = [
  {
    defaultName: 'GitHub',
    description: 'Personal access tokens, app keys, and release credentials.',
    key: 'github',
    logoFileName: 'github.png',
  },
  {
    defaultName: 'Supabase',
    description:
      'Project URLs, anon keys, service roles, and database secrets.',
    key: 'supabase',
    logoFileName: 'supabase.png',
  },
  {
    defaultName: 'AWS',
    description:
      'Access keys, secret keys, profiles, and deployment credentials.',
    key: 'aws',
    logoFileName: 'aws.png',
  },
  {
    defaultName: 'Google Cloud',
    description:
      'Service accounts, API keys, OAuth clients, and cloud credentials.',
    key: 'google-cloud',
    logoFileName: 'google-cloud.png',
  },
  {
    defaultName: 'Vercel',
    description: 'Access tokens and project or team identifiers.',
    key: 'vercel',
    logoFileName: 'vercel.png',
  },
  {
    defaultName: 'Microsoft Azure',
    description:
      'Tenant, client, subscription, and service principal credentials.',
    key: 'azure',
    logoFileName: 'azure.png',
  },
  {
    defaultName: 'Render',
    description: 'Service tokens, API keys, and deployment credentials.',
    key: 'render',
    logoFileName: 'render.png',
  },
  {
    defaultName: 'Railway',
    description: 'Project tokens, service tokens, and deployment credentials.',
    key: 'railway',
    logoFileName: 'railway.png',
  },
  {
    defaultName: 'Cloudflare',
    description: 'API tokens, account identifiers, and zone credentials.',
    key: 'cloudflare',
    logoFileName: 'cloudflare.png',
  },
  {
    defaultName: 'Docker',
    description: 'Registry tokens, usernames, and deployment credentials.',
    key: 'docker',
    logoFileName: 'docker.png',
  },
  {
    defaultName: 'npm',
    description: 'Registry automation, publish, and organization tokens.',
    key: 'npm',
    logoFileName: 'npm.png',
  },
  {
    defaultName: 'Stripe',
    description: 'Publishable keys, secret keys, and webhook signing secrets.',
    key: 'stripe',
    logoFileName: 'stripe.png',
  },
  {
    defaultName: 'Sentry',
    description: 'DSNs, auth tokens, and organization or project credentials.',
    key: 'sentry',
    logoFileName: 'sentry.png',
  },
] as const satisfies readonly PredefinedCredentialSource[];

const bundledSourceLogos = import.meta.glob('../../../assets/sources/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export function predefinedSourceLogo(
  definitionKey: string | null,
): string | null {
  const definition = PREDEFINED_CREDENTIAL_SOURCES.find(
    (item) => item.key === definitionKey,
  );
  if (!definition) return null;
  const path = `../../../assets/sources/${definition.logoFileName}`;
  return bundledSourceLogos[path] ?? null;
}

export const envSecretPreviewItemSchema = z.object({
  existingSourceName: z.string().nullable(),
  isAlreadyInVault: z.boolean(),
  isCommented: z.boolean(),
  key: z.string().min(1),
  lineNumber: z.number().int().positive(),
});
export type EnvSecretPreviewItem = z.infer<typeof envSecretPreviewItemSchema>;

export const importEnvSecretsResultSchema = z.object({
  importedCount: z.number().int().nonnegative(),
  sourceId: z.string().uuid(),
  updatedCount: z.number().int().nonnegative(),
});
export type ImportEnvSecretsResult = z.infer<
  typeof importEnvSecretsResultSchema
>;

export interface ImportEnvSecretsInput {
  environmentId?: string;
  projectId: string;
  relativePath: string;
  selectedKeys: string[];
  sourceId?: string;
  sourceName?: string;
}
