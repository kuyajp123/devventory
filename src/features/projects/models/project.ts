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

const watchedLocationsSchema = z
  .string()
  .trim()
  .min(1, 'Enter at least one relative location.')
  .refine(
    (value) =>
      splitConfigurationLines(value).every(isSafeRelativeConfigurationPath),
    'Use only relative paths inside the selected project folder; parent traversal is not allowed.',
  );

const exclusionsSchema = z
  .string()
  .refine(
    (value) =>
      splitConfigurationLines(value).every(isSafeRelativeConfigurationPath),
    'Use only relative directory prefixes; parent traversal is not allowed.',
  )
  .refine(
    (value) =>
      splitConfigurationLines(value).every(
        (entry) => !isBuiltInProjectExclusion(entry),
      ),
    'Built-in exclusions are already managed by Devventory. Add only your own additional paths.',
  );

export const projectOnboardingSchema = z.object({
  description: z.string().trim().max(2000, 'Use 2,000 characters or fewer.'),
  exclusionsText: exclusionsSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Enter a project name.')
    .max(120, 'Use 120 characters or fewer.'),
  projectType: projectTypeSchema,
  rootPath: z.string().trim().min(1, 'Choose a project folder.'),
  watchedLocationsText: watchedLocationsSchema,
});

export type ProjectOnboardingValues = z.infer<typeof projectOnboardingSchema>;

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

function isSafeRelativeConfigurationPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || /^[a-zA-Z]:\//.test(normalized) || value.startsWith('/')) {
    return false;
  }

  return normalized === '.' || !normalized.split('/').includes('..');
}

function isBuiltInProjectExclusion(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  return DEFAULT_PROJECT_EXCLUSIONS.some(
    (exclusion) => exclusion.replace(/\/$/, '').toLowerCase() === normalized,
  );
}
