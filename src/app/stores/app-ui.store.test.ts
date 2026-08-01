import { beforeEach, describe, expect, it } from 'vitest';
import { useAppUiStore } from './app-ui.store';

describe('app UI store', () => {
  beforeEach(() => {
    useAppUiStore.setState({ isNavigationCollapsed: false });
  });

  it('controls the application navigation state', () => {
    expect(useAppUiStore.getState().isNavigationCollapsed).toBe(false);

    useAppUiStore.getState().setNavigationCollapsed(true);
    expect(useAppUiStore.getState().isNavigationCollapsed).toBe(true);

    useAppUiStore.getState().toggleNavigation();
    expect(useAppUiStore.getState().isNavigationCollapsed).toBe(false);
  });
});
