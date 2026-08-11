import { describe, expect, it } from 'vitest';
import { remainingPercentProgressColor } from './agent-usage-status';

describe('remainingPercentProgressColor', () => {
  it.each([
    { color: 'danger', percentage: 0 },
    { color: 'danger', percentage: 19 },
    { color: 'warning', percentage: 20 },
    { color: 'warning', percentage: 29 },
    { color: 'success', percentage: 30 },
    { color: 'success', percentage: 99 },
    { color: 'success', percentage: 100 },
  ] as const)(
    'maps $percentage% remaining to $color',
    ({ color, percentage }) => {
      expect(remainingPercentProgressColor(percentage, false)).toBe(color);
    },
  );

  it('uses a neutral progress color when usage is unknown or stale', () => {
    expect(remainingPercentProgressColor(null, false)).toBe('default');
    expect(remainingPercentProgressColor(80, true)).toBe('default');
  });
});
