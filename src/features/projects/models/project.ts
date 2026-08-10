import { z } from 'zod';

export const DEFAULT_PROJECT_EXCLUSIONS = [
  '.cache/',
  '.git/',
  '.next/',
  '.turbo/',
  'build/',
  'coverage/',
  'dist/',
  'node_modules/',
  'target/',
  'vendor/',
] as const;

export const projectTypeSchema = z.enum([
  'web',
  'desktop',
  'mobile',
  'backend',
  'library',
  'monorepo',
  'other',
]);

export type ProjectType = z.infer<typeof projectTypeSchema>;

export const projectTypeOptions: ReadonlyArray<{
  label: string;
  value: ProjectType;
}> = [
  { label: 'Web application', value: 'web' },
  { label: 'Desktop application', value: 'desktop' },
  { label: 'Mobile application', value: 'mobile' },
  { label: 'Backend service', value: 'backend' },
  { label: 'Library or package', value: 'library' },
  { label: 'Monorepo', value: 'monorepo' },
  { label: 'Other', value: 'other' },
];

export const initialScanSummarySchema = z.object({
  completed: z.boolean(),
  directoriesVisited: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  entriesExcluded: z.number().int().nonnegative(),
  entriesUnreadable: z.number().int().nonnegative(),
  filesDiscovered: z.number().int().nonnegative(),
});

export type InitialScanSummary = z.infer<typeof initialScanSummarySchema>;

export const projectSchema = z.object({
  createdAt: z.string().min(1),
  description: z.string().nullable(),
  exclusions: z.array(z.string().min(1)),
  id: z.string().uuid(),
  initialScan: initialScanSummarySchema,
  name: z.string().min(1).max(120),
  projectType: projectTypeSchema,
  rootPath: z.string().min(1),
  updatedAt: z.string().min(1),
  watchedLocations: z.array(z.string().min(1)).min(1),
});

export const projectsSchema = z.array(projectSchema);
export type Project = z.infer<typeof projectSchema>;

export const validatedProjectRootSchema = z.object({
  rootPath: z.string().min(1),
});
export type ValidatedProjectRoot = z.infer<typeof validatedProjectRootSchema>;

export interface ProjectConfigurationInput {
  exclusions: string[];
  rootPath: string;
  watchedLocations: string[];
}

export interface CreateProjectInput extends ProjectConfigurationInput {
  description?: string;
  name: string;
  projectType: ProjectType;
}

const watchedLocationItemSchema = z
  .string()
  .trim()
  .min(1, 'Path cannot be empty.')
  .refine(
    isSafeRelativeConfigurationPath,
    'Use only relative paths inside the selected project folder; parent traversal is not allowed.',
  );

const exclusionItemSchema = z
  .string()
  .trim()
  .min(1, 'Path cannot be empty.')
  .refine(
    isSafeRelativeConfigurationPath,
    'Use only relative directory prefixes; parent traversal is not allowed.',
  )
  .refine(
    (value) => !isBuiltInProjectExclusion(value),
    'Built-in exclusions are already managed by Devventory.',
  );

export const watchScopeSchema = z.enum(['entire-project', 'selected-folders']);
export type WatchScope = z.infer<typeof watchScopeSchema>;

export const projectOnboardingSchema = z
  .object({
    description: z.string().trim().max(2000, 'Use 2,000 characters or fewer.'),
    exclusions: z.array(exclusionItemSchema),
    name: z
      .string()
      .trim()
      .min(1, 'Enter a project name.')
      .max(120, 'Use 120 characters or fewer.'),
    projectType: projectTypeSchema,
    rootPath: z.string().trim().min(1, 'Choose a project folder.'),
    watchScope: watchScopeSchema,
    watchedLocations: z
      .array(watchedLocationItemSchema)
      .min(1, 'Add at least one watched location.'),
  })
  .refine(
    (data) => {
      if (data.watchScope === 'selected-folders') {
        return (
          data.watchedLocations.length > 0 &&
          !data.watchedLocations.includes('.')
        );
      }
      return (
        data.watchedLocations.length === 1 && data.watchedLocations[0] === '.'
      );
    },
    {
      message:
        'Selected folders mode requires at least one custom folder and cannot contain the project root.',
      path: ['watchedLocations'],
    },
  );

export type ProjectOnboardingValues = z.infer<typeof projectOnboardingSchema>;

export function normalizeConfigurationPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/');
  if (normalized === '.') return '.';
  const trimmed = normalized.replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '.';
}

export function getConfigurationFingerprint(config: {
  exclusions: string[];
  rootPath: string;
  watchedLocations: string[];
}): string {
  const normRoot = config.rootPath.trim().replace(/\\/g, '/').toLowerCase();
  const normWatched = [
    ...new Set(config.watchedLocations.map(normalizeConfigurationPath)),
  ]
    .sort()
    .join('\n');
  const normExclusions = [
    ...new Set(config.exclusions.map(normalizeConfigurationPath)),
  ]
    .sort()
    .join('\n');
  return `${normRoot}|${normWatched}|${normExclusions}`;
}

export function splitConfigurationLines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

export function isSafeRelativeConfigurationPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || /^[a-zA-Z]:\//.test(normalized) || value.startsWith('/')) {
    return false;
  }

  return normalized === '.' || !normalized.split('/').includes('..');
}

export function isBuiltInProjectExclusion(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  return DEFAULT_PROJECT_EXCLUSIONS.some(
    (exclusion) => exclusion.replace(/\/$/, '').toLowerCase() === normalized,
  );
}
