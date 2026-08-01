import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import { invokeCommand } from './invoke-client';
import { TauriCommandError } from './tauri-error';

describe('invokeCommand', () => {
  it('returns the typed command response', async () => {
    mockIPC((command) => {
      expect(command).toBe('health_check');
      return 'healthy';
    });

    await expect(invokeCommand<string>('health_check')).resolves.toBe(
      'healthy',
    );
  });

  it('normalizes unknown backend failures without exposing their details', async () => {
    mockIPC(() => {
      throw new Error('sensitive backend path C:\\private\\inventory.db');
    });

    const operation = invokeCommand<string>('health_check');

    await expect(operation).rejects.toBeInstanceOf(TauriCommandError);
    await expect(operation).rejects.toMatchObject({
      command: 'health_check',
      message: 'The desktop operation could not be completed.',
    });
    await expect(operation).rejects.not.toMatchObject({
      message: expect.stringContaining('inventory.db'),
    });
  });
});
