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
      'node_modules/',
      '.git/',
      '.next/',
      'dist/',
      'build/',
      'target/',
      'coverage/',
      '.cache/',
      '.turbo/',
      'vendor/',
    ]);
  });

  it('allows the user to remove every default exclusion', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        exclusionsText: '',
      }).success,
    ).toBe(true);
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
