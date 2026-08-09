import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  projectOnboardingSchema,
  splitConfigurationLines,
} from './project';

const validForm = {
  description: '',
  exclusionsText: 'node_modules/',
  name: 'Devventory',
  projectType: 'desktop' as const,
  rootPath: 'C:\\workspace\\devventory',
  watchedLocationsText: '.',
};

describe('project onboarding schema', () => {
  it('keeps the documented Phase 3 and Phase 4 default exclusions', () => {
    expect(DEFAULT_PROJECT_EXCLUSIONS).toEqual([
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
    ]);
  });

  it('allows the user to provide no additional exclusions', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        exclusionsText: '',
      }).success,
    ).toBe(true);
  });

  it('prevents built-in exclusions from being configured as custom entries', () => {
    const result = projectOnboardingSchema.safeParse({
      ...validForm,
      exclusionsText: '.git/',
    });

    expect(result.success).toBe(false);
  });

  it('rejects parent traversal in watched locations', () => {
    const result = projectOnboardingSchema.safeParse({
      ...validForm,
      watchedLocationsText: '../outside',
    });

    expect(result.success).toBe(false);
  });

  it('removes blank and duplicate configuration lines', () => {
    expect(splitConfigurationLines('src\n\nsrc\nassets')).toEqual([
      'src',
      'assets',
    ]);
  });
});
