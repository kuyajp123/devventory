import { open } from '@tauri-apps/plugin-dialog';

export const folderPickerGateway = {
  async selectProjectRoot(): Promise<string | null> {
    return this.selectDirectory('Choose a project folder');
  },

  async selectDirectory(title = 'Choose a folder'): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title,
    });

    return typeof selected === 'string' ? selected : null;
  },
};
