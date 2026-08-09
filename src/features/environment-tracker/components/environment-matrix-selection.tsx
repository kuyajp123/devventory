import type { PropsWithChildren } from 'react';
import {
  EnvironmentMatrixSelectionContext,
  type EnvironmentMatrixSelectionStore,
} from './environment-matrix-selection-context';

export function EnvironmentMatrixSelectionProvider({
  children,
  store,
}: PropsWithChildren<{ store: EnvironmentMatrixSelectionStore }>) {
  return (
    <EnvironmentMatrixSelectionContext.Provider value={store}>
      {children}
    </EnvironmentMatrixSelectionContext.Provider>
  );
}
