import { invoke } from '@tauri-apps/api/core';

type CommandArguments = Record<string, unknown>;

export function invokeCommand<TResponse>(command: string, args?: CommandArguments): Promise<TResponse> {
  return invoke<TResponse>(command, args);
}
