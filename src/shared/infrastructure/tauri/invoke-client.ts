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
  AGENT_USAGE_CONFLICT:
    'That Agent Usage account or quota window is already being tracked.',
  ASSET_CONFLICT:
    'A file already exists at that destination. Choose how to continue.',
  CREDENTIAL_VAULT_PASSWORD_INCORRECT:
    'The master password is incorrect. Try again.',
  ENVIRONMENT_CONFLICT: 'That environment configuration already exists.',
  FILESYSTEM_UNAVAILABLE:
    'The selected folder cannot be read. Check its permissions and try again.',
  INVALID_INPUT: 'The request contains invalid data.',
  MANIFEST_CONFLICT:
    'A file already exists at that destination. Confirm replacement to continue.',
  MANIFEST_PATH_INVALID:
    'The manifest destination must stay inside the project root and use existing folders.',
  NOT_FOUND: 'The requested project could not be found.',
  OPERATION_UNAVAILABLE: 'That file action is unavailable on this device.',
  PATH_OUTSIDE_ROOT:
    'Watched locations must stay inside the selected project folder.',
  PROJECT_ROOT_CONFLICT: 'That project folder is already registered.',
  ROOT_NOT_DIRECTORY: 'The selected project root is not a folder.',
  ROOT_NOT_FOUND: 'The selected project folder does not exist.',
  STORAGE_UNAVAILABLE: 'Local application data is unavailable.',
  WATCHED_LOCATION_INVALID:
    'A watched location is missing, unreadable, or not a folder.',
  VALIDATION_CONFLICT:
    'A rule of that type already exists for this environment key.',
};

const commandSafeMessages: Record<string, Record<string, string>> = {
  save_agent_quota: {
    AGENT_USAGE_CONFLICT:
      'That quota window label is already used for this account.',
  },
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
  const message = commandSafeMessages[command]?.[code] ?? safeMessages[code];
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
