import { createContext, useContext } from 'react';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';

export const EnvironmentMatrixSelectionContext =
  createContext<EnvironmentKeySelection | null>(null);

export function useEnvironmentMatrixSelection() {
  return useContext(EnvironmentMatrixSelectionContext);
}
