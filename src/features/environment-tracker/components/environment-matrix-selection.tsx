import type { PropsWithChildren } from 'react';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { EnvironmentMatrixSelectionContext } from './environment-matrix-selection-context';

export function EnvironmentMatrixSelectionProvider({
  children,
  selection,
}: PropsWithChildren<{ selection: EnvironmentKeySelection | null }>) {
  return (
    <EnvironmentMatrixSelectionContext.Provider value={selection}>
      {children}
    </EnvironmentMatrixSelectionContext.Provider>
  );
}
