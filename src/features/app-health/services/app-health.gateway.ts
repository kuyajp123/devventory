import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';

export const appHealthGateway = {
  check(): Promise<string> {
    return invokeCommand<string>('health_check');
  },
};
