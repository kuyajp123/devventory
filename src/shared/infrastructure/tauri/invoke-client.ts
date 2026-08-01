import { invoke } from '@tauri-apps/api/core';
import { TauriCommandError } from './tauri-error';

type CommandArguments = Record<string, unknown>;

export async function invokeCommand<TResponse>(
  command: string,
  args?: CommandArguments,
): Promise<TResponse> {
  try {
    return await invoke<TResponse>(command, args);
  } catch {
    throw new TauriCommandError(command);
  }
}
