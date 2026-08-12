import { describe, expect, it } from 'vitest';
import {
  PROGRESS_FILL_CLASSES,
  remainingPercentProgressColor,
  remainingPercentProgressFillClass,
} from './agent-usage-status';

describe('remainingPercentProgressColor', () => {
  it.each([
    { color: 'danger', fillClass: 'bg-danger', percentage: 0 },
    { color: 'danger', fillClass: 'bg-danger', percentage: 15 },
    { color: 'danger', fillClass: 'bg-danger', percentage: 19.99 },
    { color: 'warning', fillClass: 'bg-warning', percentage: 20 },
    { color: 'warning', fillClass: 'bg-warning', percentage: 25 },
    { color: 'warning', fillClass: 'bg-warning', percentage: 29.99 },
    { color: 'success', fillClass: 'bg-success', percentage: 30 },
    { color: 'success', fillClass: 'bg-success', percentage: 50 },
    { color: 'success', fillClass: 'bg-success', percentage: 90 },
    { color: 'success', fillClass: 'bg-success', percentage: 100 },
  ])(
    'maps $percentage% remaining to color $color and fill class $fillClass',
    ({ color, fillClass, percentage }) => {
      expect(remainingPercentProgressColor(percentage, false)).toBe(color);
      expect(remainingPercentProgressFillClass(percentage, false)).toBe(
        fillClass,
      );
    },
  );

  it('uses neutral default progress color and bg-muted when usage is unknown or stale', () => {
    expect(remainingPercentProgressColor(null, false)).toBe('default');
    expect(remainingPercentProgressFillClass(null, false)).toBe('bg-muted');

    expect(remainingPercentProgressColor(90, true)).toBe('default');
    expect(remainingPercentProgressFillClass(90, true)).toBe('bg-muted');
  });

  it('provides a complete mapping in PROGRESS_FILL_CLASSES for all color tokens', () => {
    expect(PROGRESS_FILL_CLASSES).toEqual({
      danger: 'bg-danger',
      default: 'bg-muted',
      success: 'bg-success',
      warning: 'bg-warning',
    });
  });
});
