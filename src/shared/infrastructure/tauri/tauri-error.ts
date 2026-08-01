export class TauriCommandError extends Error {
  readonly command: string;

  constructor(command: string) {
    super('The desktop operation could not be completed.');
    this.name = 'TauriCommandError';
    this.command = command;
  }
}
