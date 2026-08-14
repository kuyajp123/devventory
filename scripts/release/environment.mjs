const SIGNING_SECRET_NAMES = new Set([
  'TAURI_SIGNING_PRIVATE_KEY',
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
]);

export const RELEASE_SECRET_NAMES = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'SOURCE_GITHUB_TOKEN',
  'RELEASE_TOKEN',
  ...SIGNING_SECRET_NAMES,
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
];

export function sanitizeReleaseEnvironment(
  source = process.env,
  { keepSigning = false } = {},
) {
  const sanitized = { ...source };
  for (const name of RELEASE_SECRET_NAMES) {
    if (!keepSigning || !SIGNING_SECRET_NAMES.has(name)) delete sanitized[name];
  }
  return sanitized;
}

export async function withReleaseSecretsHidden(operation) {
  const saved = new Map(
    RELEASE_SECRET_NAMES.map((name) => [name, process.env[name]]),
  );
  for (const name of RELEASE_SECRET_NAMES) delete process.env[name];

  try {
    return await operation(sanitizeReleaseEnvironment());
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
