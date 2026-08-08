import { z } from 'zod';
import { fileCategorySchema } from '@/features/file-inventory';

const nonnegativeInteger = z.number().int().nonnegative();

export const dashboardMetricsSchema = z.object({
  environmentKeys: nonnegativeInteger,
  environments: nonnegativeInteger,
  indexedFiles: nonnegativeInteger,
  lastScanAt: z.string().nullable(),
  managedAssets: nonnegativeInteger,
  missingFiles: nonnegativeInteger,
  openValidationIssues: nonnegativeInteger,
  watchedLocations: nonnegativeInteger,
  watcherStatus: z.literal('unavailable'),
});

export const projectDashboardSchema = z.object({
  environmentCoverage: z.array(
    z.object({
      coveragePercent: z.number().min(0).max(100).nullable(),
      environmentId: z.string().uuid(),
      knownKeys: nonnegativeInteger,
      name: z.string().min(1),
      presentKeys: nonnegativeInteger,
      unavailableSources: nonnegativeInteger,
    }),
  ),
  fileCategories: z.array(
    z.object({ category: fileCategorySchema, count: nonnegativeInteger }),
  ),
  metrics: dashboardMetricsSchema,
  projectId: z.string().uuid(),
  recentScans: z
    .array(
      z.object({
        completedAt: z.string().nullable(),
        durationMs: nonnegativeInteger,
        entriesUnreadable: nonnegativeInteger,
        filesAdded: nonnegativeInteger,
        filesDiscovered: nonnegativeInteger,
        filesMissing: nonnegativeInteger,
        filesUpdated: nonnegativeInteger,
        id: z.string().uuid(),
        scanType: z.enum([
          'initial',
          'startup',
          'manual_project',
          'manual_location',
          'watcher',
        ]),
        startedAt: z.string().min(1),
        status: z.enum(['running', 'completed', 'partial', 'failed']),
      }),
    )
    .max(8),
  validationSeverities: z.array(
    z.object({
      count: nonnegativeInteger,
      severity: z.enum(['info', 'warning', 'error']),
    }),
  ),
});

export type ProjectDashboard = z.infer<typeof projectDashboardSchema>;
