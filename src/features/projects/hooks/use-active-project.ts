import { useContext } from 'react';
import {
  ActiveProjectContext,
  type ActiveProjectContextValue,
} from '../providers/active-project.context';

export function useActiveProject(): ActiveProjectContextValue {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error(
      'useActiveProject must be used inside ActiveProjectProvider.',
    );
  }
  return context;
}
