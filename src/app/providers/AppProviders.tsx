import { Toast } from '@heroui/react';
import type { PropsWithChildren } from 'react';
import { AppUpdaterSync } from '@/features/app-updater';
import { InventoryEventSync } from '@/features/file-inventory';
import { EnvironmentEventSync } from '@/features/environment-tracker';
import { ActiveProjectProvider } from '@/features/projects';
import { ValidationEventSync } from '@/features/validation-center';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <ActiveProjectProvider>
        <AppUpdaterSync />
        <InventoryEventSync />
        <EnvironmentEventSync />
        <ValidationEventSync />
        <Toast.Provider placement="bottom end" />
        {children}
      </ActiveProjectProvider>
    </QueryProvider>
  );
}
