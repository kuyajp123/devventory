import { describe, expect, it } from 'vitest';
import {
  backgroundStartupPreferencesSchema,
  notificationPreferencesSchema,
} from './settings';

describe('settings models', () => {
  it('parses valid notification preferences', () => {
    const valid = {
      enabled: true,
      inAppEnabled: true,
      systemEnabled: false,
    };
    expect(notificationPreferencesSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid notification preferences', () => {
    const invalid = {
      enabled: 'true',
      inAppEnabled: true,
      systemEnabled: false,
    };
    expect(() => notificationPreferencesSchema.parse(invalid)).toThrow();
  });

  it('parses valid background startup preferences', () => {
    const valid = {
      keepRunningWhenClosed: true,
      startWithWindows: false,
    };
    expect(backgroundStartupPreferencesSchema.parse(valid)).toEqual(valid);
  });
});
