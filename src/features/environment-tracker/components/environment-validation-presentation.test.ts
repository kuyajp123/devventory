import { describe, expect, it } from 'vitest';
import {
  getEnvironmentCellPresentation,
  highestOpenValidationSeverity,
} from './environment-validation-presentation';

describe('environment validation cell presentation', () => {
  it('uses the highest open severity and never treats healthy history as an alert', () => {
    expect(
      highestOpenValidationSeverity([
        { severity: 'info', status: 'open' },
        { severity: 'error', status: 'resolved' },
        { severity: 'warning', status: 'open' },
      ]),
    ).toBe('warning');
    expect(
      highestOpenValidationSeverity([
        { severity: 'error', status: 'ignored' },
        { severity: 'warning', status: 'resolved' },
      ]),
    ).toBeNull();
  });

  it('keeps validation on the outer border and selection on a neutral inset ring', () => {
    const selectedError = getEnvironmentCellPresentation('error', true);
    expect(selectedError).toContain('border-danger');
    expect(selectedError).toContain('ring-inset');
    expect(selectedError).not.toContain('border-accent');
    expect(selectedError).not.toContain('border-success');

    const healthy = getEnvironmentCellPresentation(null, false);
    expect(healthy).toContain('border-transparent');
    expect(healthy).not.toContain('border-success');
  });

  it.each([
    ['error', 'border-danger'],
    ['warning', 'border-warning'],
    ['info', 'border-accent/60'],
  ] as const)(
    'maps open %s findings to the same exceptional border',
    (severity, border) => {
      expect(getEnvironmentCellPresentation(severity, false)).toContain(border);
    },
  );

  it('uses only neutral selection treatment for a selected healthy cell', () => {
    const selectedHealthy = getEnvironmentCellPresentation(null, true);

    expect(selectedHealthy).toContain('border-transparent');
    expect(selectedHealthy).toContain('ring-inset');
    for (const className of [
      'border-danger',
      'border-warning',
      'border-accent',
      'border-success',
    ]) {
      expect(selectedHealthy).not.toContain(className);
    }
  });
});
