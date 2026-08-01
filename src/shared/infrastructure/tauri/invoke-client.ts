import { invoke } from '@tauri-apps/api/core';
import { TauriCommandError } from './tauri-error';

type CommandArguments = Record<string, unknown>;

export async function invokeCommand<TResponse>(
  command: string,
  args?: CommandArguments,
): Promise<TResponse> {
  try {
    return await invoke<TResponse>(command, args);
  } catch (error) {
    throw normalizeCommandError(command, error);
  }
}

const safeMessages: Record<string, string> = {
  FILESYSTEM_UNAVAILABLE:
    'The selected folder cannot be read. Check its permissions and try again.',
  INVALID_INPUT: 'The project configuration contains invalid data.',
  NOT_FOUND: 'The requested project could not be found.',
  PATH_OUTSIDE_ROOT:
    'Watched locations must stay inside the selected project folder.',
  PROJECT_ROOT_CONFLICT: 'That project folder is already registered.',
  ROOT_NOT_DIRECTORY: 'The selected project root is not a folder.',
  ROOT_NOT_FOUND: 'The selected project folder does not exist.',
  STORAGE_UNAVAILABLE: 'Local application data is unavailable.',
  WATCHED_LOCATION_INVALID:
    'A watched location is missing, unreadable, or not a folder.',
};

function normalizeCommandError(
  command: string,
  error: unknown,
): TauriCommandError {
  if (typeof error !== 'object' || error === null) {
    return new TauriCommandError(command);
  }

  const candidate = error as Record<string, unknown>;
  const code = typeof candidate.code === 'string' ? candidate.code : 'UNKNOWN';
  const message = safeMessages[code];
  if (!message) {
    return new TauriCommandError(command);
  }

  return new TauriCommandError(command, {
    code,
    message,
    recoverable:
      typeof candidate.recoverable === 'boolean' ? candidate.recoverable : true,
  });
}
