import { mockIPC } from '@tauri-apps/api/mocks';

export function installTauriBrowserMocks() {
  mockIPC((command) => {
    if (command === 'health_check') {
      return 'Devventory Rust backend is running';
    }

    throw new Error(`Unhandled E2E command: ${command}`);
  });
}
