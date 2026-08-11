import type { ProjectDashboard } from './dashboard';

const VALIDATION_SEVERITY_COLORS = {
  error: 'var(--danger)',
  info: 'var(--info)',
  warning: 'var(--warning)',
} as const;

export function validationSeverityColor(
  severity: ProjectDashboard['validationSeverities'][number]['severity'],
): string {
  return VALIDATION_SEVERITY_COLORS[severity];
}
