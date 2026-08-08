import { Toast } from '@heroui/react';
import type { PropsWithChildren } from 'react';
import { AgentUsageReminderSync } from '@/features/agent-usage';
import { InventoryEventSync } from '@/features/file-inventory';
import { EnvironmentEventSync } from '@/features/environment-tracker';
import { ActiveProjectProvider } from '@/features/projects';
import { ValidationEventSync } from '@/features/validation-center';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AgentUsageReminderSync />
      <ActiveProjectProvider>
        <InventoryEventSync />
        <EnvironmentEventSync />
        <ValidationEventSync />
        <Toast.Provider placement="bottom end" />
        {children}
      </ActiveProjectProvider>
    </QueryProvider>
  );
}
