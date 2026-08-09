import { createContext, useContext, useSyncExternalStore } from 'react';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';

export const EnvironmentMatrixSelectionContext =
  createContext<EnvironmentMatrixSelectionStore | null>(null);

type SelectionUpdater = (
  selection: EnvironmentKeySelection | null,
) => EnvironmentKeySelection | null;

export interface EnvironmentMatrixSelectionStore {
  getSelection: () => EnvironmentKeySelection | null;
  setSelection: (
    selection: EnvironmentKeySelection | null | SelectionUpdater,
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createEnvironmentMatrixSelectionStore(): EnvironmentMatrixSelectionStore {
  let selection: EnvironmentKeySelection | null = null;
  const listeners = new Set<() => void>();

  return {
    getSelection: () => selection,
    setSelection: (nextSelection) => {
      const next =
        typeof nextSelection === 'function'
          ? nextSelection(selection)
          : nextSelection;

      if (Object.is(selection, next)) return;

      selection = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useEnvironmentMatrixCellSelection(
  keyName: string,
  environmentId: string,
  sourcePath?: string,
): boolean {
  const store = useEnvironmentMatrixSelectionContext();

  return useSyncExternalStore(
    store.subscribe,
    () =>
      selectionMatchesCell(
        store.getSelection(),
        keyName,
        environmentId,
        sourcePath,
      ),
    () => false,
  );
}

export function useEnvironmentMatrixSelectionStore(
  store: EnvironmentMatrixSelectionStore,
): EnvironmentKeySelection | null {
  return useSyncExternalStore(
    store.subscribe,
    store.getSelection,
    store.getSelection,
  );
}

function useEnvironmentMatrixSelectionContext(): EnvironmentMatrixSelectionStore {
  const store = useContext(EnvironmentMatrixSelectionContext);

  if (!store) {
    throw new Error(
      'Environment matrix selection must be used inside its provider.',
    );
  }

  return store;
}

function selectionMatchesCell(
  selection: EnvironmentKeySelection | null,
  keyName: string,
  environmentId: string,
  sourcePath?: string,
): boolean {
  if (
    selection?.keyName !== keyName ||
    selection.environment.id !== environmentId
  ) {
    return false;
  }

  return sourcePath === undefined
    ? selection.selectedSourcePath === undefined
    : selection.selectedSourcePath === sourcePath;
}
