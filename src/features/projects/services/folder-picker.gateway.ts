import { open } from '@tauri-apps/plugin-dialog';

export const folderPickerGateway = {
  async selectProjectRoot(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Choose a project folder',
    });

    return typeof selected === 'string' ? selected : null;
  },
};
