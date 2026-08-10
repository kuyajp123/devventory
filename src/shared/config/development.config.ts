export const DEVELOPMENT_FEATURES = {
  diagnostics: true,
} as const;

export const IS_DIAGNOSTICS_ENABLED =
  import.meta.env.DEV && DEVELOPMENT_FEATURES.diagnostics;
