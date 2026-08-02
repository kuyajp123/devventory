import { Toast } from '@heroui/react';
import type { PropsWithChildren } from 'react';
import { InventoryEventSync } from '@/features/file-inventory';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <InventoryEventSync />
      <Toast.Provider placement="bottom end" />
      {children}
    </QueryProvider>
  );
}
