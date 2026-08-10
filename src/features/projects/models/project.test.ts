import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_EXCLUSIONS,
  getConfigurationFingerprint,
  normalizeConfigurationPath,
  projectOnboardingSchema,
} from './project';

const validForm = {
  description: '',
  exclusions: ['logs/'],
  name: 'Devventory',
  projectType: 'desktop' as const,
  rootPath: 'C:\\workspace\\devventory',
  watchScope: 'entire-project' as const,
  watchedLocations: ['.'],
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

  it('validates entire-project watch scope', () => {
    expect(projectOnboardingSchema.safeParse(validForm).success).toBe(true);
  });

  it('validates selected-folders watch scope with custom folders', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        watchScope: 'selected-folders',
        watchedLocations: ['src/', 'assets/'],
      }).success,
    ).toBe(true);
  });

  it('rejects selected-folders watch scope if no custom folders are provided', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        watchScope: 'selected-folders',
        watchedLocations: [],
      }).success,
    ).toBe(false);
  });

  it('rejects selected-folders watch scope if project root . is included', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        watchScope: 'selected-folders',
        watchedLocations: ['.'],
      }).success,
    ).toBe(false);
  });

  it('allows the user to provide no additional exclusions', () => {
    expect(
      projectOnboardingSchema.safeParse({
        ...validForm,
        exclusions: [],
      }).success,
    ).toBe(true);
  });

  it('prevents built-in exclusions from being configured as custom entries', () => {
    const result = projectOnboardingSchema.safeParse({
      ...validForm,
      exclusions: ['.git/'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects parent traversal in watched locations', () => {
    const result = projectOnboardingSchema.safeParse({
      ...validForm,
      watchScope: 'selected-folders',
      watchedLocations: ['../outside'],
    });

    expect(result.success).toBe(false);
  });

  it('normalizes configuration paths consistently', () => {
    expect(normalizeConfigurationPath('.')).toBe('.');
    expect(normalizeConfigurationPath('src\\components')).toBe(
      'src/components/',
    );
    expect(normalizeConfigurationPath('/src/components/')).toBe(
      'src/components/',
    );
  });

  it('produces deterministic configuration fingerprints regardless of list order or slash style', () => {
    const fp1 = getConfigurationFingerprint({
      exclusions: ['logs/', 'tmp/'],
      rootPath: 'C:\\workspace\\devventory',
      watchedLocations: ['assets\\', 'src\\'],
    });

    const fp2 = getConfigurationFingerprint({
      exclusions: ['tmp/', 'logs\\'],
      rootPath: 'c:/workspace/devventory',
      watchedLocations: ['src/', 'assets/'],
    });

    expect(fp1).toBe(fp2);
  });
});
