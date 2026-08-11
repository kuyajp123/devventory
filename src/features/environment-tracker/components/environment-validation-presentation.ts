import type { EnvironmentMatrixValidationIssue as MatrixIssue } from '../models/environment';

export type OpenValidationSeverity = MatrixIssue['severity'];

export function highestOpenValidationSeverity(
  issues: ReadonlyArray<Pick<MatrixIssue, 'severity' | 'status'>>,
): OpenValidationSeverity | null {
  let highest: OpenValidationSeverity | null = null;
  for (const issue of issues) {
    if (issue.status !== 'open') continue;
    if (issue.severity === 'error') return 'error';
    if (issue.severity === 'warning') highest = 'warning';
    else if (highest === null) highest = 'info';
  }
  return highest;
}

export function validationSeverityLabel(
  issues: readonly MatrixIssue[],
): string | null {
  const severity = highestOpenValidationSeverity(issues);
  if (!severity) return null;
  const count = issues.filter(
    (issue) => issue.status === 'open' && issue.severity === severity,
  ).length;
  return `${count} open ${severity} validation issue${count === 1 ? '' : 's'}`;
}

export function getEnvironmentCellPresentation(
  severity: OpenValidationSeverity | null,
  isSelected: boolean,
): string {
  const border =
    severity === 'error'
      ? 'border-danger'
      : severity === 'warning'
        ? 'border-warning'
        : severity === 'info'
          ? 'border-accent/60'
          : 'border-transparent';
  const selection = isSelected
    ? 'bg-surface-secondary ring-2 ring-inset ring-foreground/25'
    : '';
  return `${border} ${selection}`.trim();
}
