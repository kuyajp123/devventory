import { describe, expect, it } from 'vitest';
import { validationSeverityColor } from './dashboard-chart-colors';

describe('validationSeverityColor', () => {
  it.each([
    ['error', 'var(--danger)'],
    ['warning', 'var(--warning)'],
    ['info', 'var(--info)'],
  ] as const)('maps %s findings to %s', (severity, color) => {
    expect(validationSeverityColor(severity)).toBe(color);
  });
});
