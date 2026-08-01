import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { appHealthGateway } from './app-health.gateway';

describe('appHealthGateway', () => {
  it('invokes the Rust health-check command', async () => {
    mockIPC((command) => {
      expect(command).toBe('health_check');
      return 'Devventory Rust backend is running';
    });

    await expect(appHealthGateway.check()).resolves.toBe(
      'Devventory Rust backend is running',
    );
  });
});
