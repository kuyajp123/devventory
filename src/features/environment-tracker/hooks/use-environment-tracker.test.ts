import { describe, expect, it } from 'vitest';
import { environmentTrackerKeys } from './use-environment-tracker';

describe('environmentTrackerKeys', () => {
  it('isolates persisted queries by active project', () => {
    expect(environmentTrackerKeys.environments('project-a')).toEqual([
      'environment-tracker',
      'project-a',
      'environments',
    ]);
    expect(environmentTrackerKeys.matrix('project-b', 'API', 2, 50)).toEqual([
      'environment-tracker',
      'project-b',
      'matrix',
      { page: 2, pageSize: 50, search: 'API' },
    ]);
  });
});
