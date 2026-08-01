export class TauriCommandError extends Error {
  readonly command: string;
  readonly code: string;
  readonly recoverable: boolean;

  constructor(
    command: string,
    options: {
      code?: string;
      message?: string;
      recoverable?: boolean;
    } = {},
  ) {
    super(options.message ?? 'The desktop operation could not be completed.');
    this.name = 'TauriCommandError';
    this.command = command;
    this.code = options.code ?? 'UNKNOWN';
    this.recoverable = options.recoverable ?? true;
  }
}
