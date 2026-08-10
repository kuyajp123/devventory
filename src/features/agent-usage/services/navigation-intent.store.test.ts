import { beforeEach, describe, expect, it } from 'vitest';
import { navigationIntentStore } from './navigation-intent.store';

describe('navigationIntentStore', () => {
  beforeEach(() => {
    navigationIntentStore.clear();
  });

  it('stores and clears individual navigation intent exactly once', () => {
    expect(navigationIntentStore.peekIntent()).toBeNull();

    navigationIntentStore.setIntent({
      accountId: 'acc-123',
      quotaWindowId: 'quota-456',
      type: 'individual',
    });

    expect(navigationIntentStore.peekIntent()).toEqual({
      accountId: 'acc-123',
      quotaWindowId: 'quota-456',
      type: 'individual',
    });

    const intent = navigationIntentStore.getAndClearIntent();
    expect(intent).toEqual({
      accountId: 'acc-123',
      quotaWindowId: 'quota-456',
      type: 'individual',
    });

    expect(navigationIntentStore.getAndClearIntent()).toBeNull();
  });

  it('stores and clears burst navigation intent', () => {
    navigationIntentStore.setIntent({ type: 'burst' });

    expect(navigationIntentStore.getAndClearIntent()).toEqual({
      type: 'burst',
    });
    expect(navigationIntentStore.getAndClearIntent()).toBeNull();
  });
});
