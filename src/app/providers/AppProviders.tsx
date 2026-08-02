import type { PropsWithChildren } from 'react';
import { InventoryEventSync } from '@/features/file-inventory';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <InventoryEventSync />
      {children}
    </QueryProvider>
  );
}
