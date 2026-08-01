import { describe, expect, it } from 'vitest';
import { projectOnboardingSchema, splitConfigurationLines } from './project';

const validForm = {
  description: '',
  exclusionsText: 'node_modules/',
  name: 'Devventory',
  projectType: 'desktop' as const,
  rootPath: 'C:\\workspace\\devventory',
  watchedLocationsText: '.',
};

describe('project onboarding schema', () => {
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
