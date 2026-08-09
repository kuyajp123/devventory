import { describe, expect, it } from 'vitest';
import {
  areEnvironmentOrdersEqual,
  getMatrixTableMinWidth,
  mergePreferredEnvironmentOrder,
  reorderEnvironmentIds,
  resolveEnvironmentReorder,
} from './environment-matrix-layout';

describe('environment-matrix-layout', () => {
  const environmentIds = ['env-a', 'env-b', 'env-c'];

  it('calculates a minimum table width from fixed column sizes', () => {
    expect(getMatrixTableMinWidth(0)).toBe(340);
    expect(getMatrixTableMinWidth(2)).toBe(780);
  });

  it('moves the first environment column to the last position', () => {
    expect(reorderEnvironmentIds(environmentIds, 'env-a', 'env-c')).toEqual([
      'env-b',
      'env-c',
      'env-a',
    ]);
  });

  it('moves the last environment column to the first position', () => {
    expect(reorderEnvironmentIds(environmentIds, 'env-c', 'env-a')).toEqual([
      'env-c',
      'env-a',
      'env-b',
    ]);
  });

  it('returns null for invalid or unchanged drops', () => {
    expect(resolveEnvironmentReorder(environmentIds, null, 'env-b')).toBeNull();
    expect(resolveEnvironmentReorder(environmentIds, 'env-a', null)).toBeNull();
    expect(
      resolveEnvironmentReorder(environmentIds, 'env-a', 'env-a'),
    ).toBeNull();
    expect(
      resolveEnvironmentReorder(environmentIds, 'missing', 'env-b'),
    ).toBeNull();
  });

  it('preserves preferred order while adding newly discovered environments', () => {
    expect(
      mergePreferredEnvironmentOrder(
        ['env-a', 'env-b', 'env-d'],
        ['env-b', 'env-a'],
      ),
    ).toEqual(['env-b', 'env-a', 'env-d']);
  });

  it('compares environment order by stable ids', () => {
    expect(areEnvironmentOrdersEqual(['env-a'], ['env-a'])).toBe(true);
    expect(areEnvironmentOrdersEqual(['env-a'], ['env-b'])).toBe(false);
  });
});
