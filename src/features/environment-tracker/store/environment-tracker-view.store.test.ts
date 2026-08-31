import { beforeEach, describe, expect, it } from 'vitest';
import { environmentTrackerViewStore } from './environment-tracker-view.store';

describe('environmentTrackerViewStore', () => {
  beforeEach(() => {
    environmentTrackerViewStore.clear();
  });

  it('returns default state for uninitialized project', () => {
    const state = environmentTrackerViewStore.getViewState('proj-1');
    expect(state).toEqual({
      page: 1,
      scrollPosition: { scrollLeft: 0, scrollTop: 0 },
      search: '',
      selectedCell: null,
      selectedEnvironmentId: null,
      view: 'compare',
    });
  });

  it('updates and persists selectedCell per project', () => {
    environmentTrackerViewStore.setSelectedCell('proj-1', {
      environmentId: 'env-1',
      keyName: 'API_KEY',
    });
    expect(
      environmentTrackerViewStore.getViewState('proj-1').selectedCell,
    ).toEqual({
      environmentId: 'env-1',
      keyName: 'API_KEY',
    });

    expect(
      environmentTrackerViewStore.getViewState('proj-2').selectedCell,
    ).toBeNull();
  });

  it('updates and persists page per project', () => {
    environmentTrackerViewStore.setPage('proj-1', 3);
    expect(environmentTrackerViewStore.getViewState('proj-1').page).toBe(3);

    // proj-2 should still be at default page 1
    expect(environmentTrackerViewStore.getViewState('proj-2').page).toBe(1);
  });

  it('updates and persists scroll position per project', () => {
    environmentTrackerViewStore.setScrollPosition('proj-1', {
      scrollLeft: 120,
      scrollTop: 450,
    });
    expect(
      environmentTrackerViewStore.getViewState('proj-1').scrollPosition,
    ).toEqual({
      scrollLeft: 120,
      scrollTop: 450,
    });

    expect(
      environmentTrackerViewStore.getViewState('proj-2').scrollPosition,
    ).toEqual({
      scrollLeft: 0,
      scrollTop: 0,
    });
  });

  it('updates search, view, and selected environment', () => {
    environmentTrackerViewStore.setSearch('proj-1', 'API_KEY');
    environmentTrackerViewStore.setView('proj-1', 'inspect');
    environmentTrackerViewStore.setSelectedEnvironmentId('proj-1', 'env-1');

    const state = environmentTrackerViewStore.getViewState('proj-1');
    expect(state.search).toBe('API_KEY');
    expect(state.view).toBe('inspect');
    expect(state.selectedEnvironmentId).toBe('env-1');
  });

  it('resets a specific project state', () => {
    environmentTrackerViewStore.setPage('proj-1', 4);
    environmentTrackerViewStore.resetProjectState('proj-1');
    expect(environmentTrackerViewStore.getViewState('proj-1').page).toBe(1);
  });
});
