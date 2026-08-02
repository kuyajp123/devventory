import { mockIPC } from '@tauri-apps/api/mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetLibraryGateway } from './asset-library.gateway';

const nativeMocks = vi.hoisted(() => ({
  dragHandler: undefined as
    | ((event: { payload: { paths: string[]; type: string } }) => void)
    | undefined,
  open: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: nativeMocks.open }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn(
      async (
        handler: (event: {
          payload: { paths: string[]; type: string };
        }) => void,
      ) => {
        nativeMocks.dragHandler = handler;
        return nativeMocks.unlisten;
      },
    ),
  }),
}));

describe('assetLibraryGateway', () => {
  beforeEach(() => {
    nativeMocks.dragHandler = undefined;
    nativeMocks.open.mockReset();
  });

  it('sends bounded server-side filters through the typed command boundary', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    mockIPC((command, args) => {
      expect(command).toBe('list_assets');
      expect(args).toEqual({
        input: {
          favorite: true,
          page: 1,
          pageSize: 30,
          projectId,
          search: 'logo',
          sortBy: 'relativePath',
          sortDirection: 'ascending',
        },
      });
      return { items: [], page: 1, pageSize: 30, totalItems: 0, totalPages: 0 };
    });

    await expect(
      assetLibraryGateway.list(projectId, {
        favorite: true,
        page: 1,
        pageSize: 30,
        search: 'logo',
        sortBy: 'relativePath',
        sortDirection: 'ascending',
      }),
    ).resolves.toMatchObject({ totalItems: 0 });
  });

  it('rejects malformed asset data returned across IPC', async () => {
    mockIPC(() => ({ items: [{ relativePath: '../escape' }] }));
    await expect(
      assetLibraryGateway.list('30af17bd-2dd6-4b89-a5e7-8517191815a7', {
        page: 1,
        pageSize: 30,
        sortBy: 'relativePath',
        sortDirection: 'ascending',
      }),
    ).rejects.toThrow();
  });

  it('uses a single-file native selection contract', async () => {
    nativeMocks.open.mockResolvedValue('C:\\external\\logo.png');

    await expect(assetLibraryGateway.selectSource()).resolves.toBe(
      'C:\\external\\logo.png',
    );
    expect(nativeMocks.open).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      title: 'Choose a file to import',
    });
  });

  it('forwards only operating-system file drop events', async () => {
    const onDrop = vi.fn();
    const unlisten = await assetLibraryGateway.subscribeToFileDrops(onDrop);

    nativeMocks.dragHandler?.({ payload: { paths: [], type: 'enter' } });
    nativeMocks.dragHandler?.({
      payload: { paths: ['C:\\external\\logo.png'], type: 'drop' },
    });

    expect(onDrop).toHaveBeenCalledOnce();
    expect(onDrop).toHaveBeenCalledWith('C:\\external\\logo.png');
    unlisten();
    expect(nativeMocks.unlisten).toHaveBeenCalledOnce();
  });

  it('maps quick actions without opening real applications in tests', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
    mockIPC((command, args) => {
      expect(command).toBe('run_asset_action');
      expect(args).toEqual({
        input: { action: 'copy_relative_path', assetId, projectId },
      });
      return 'assets/logo.png';
    });

    await expect(
      assetLibraryGateway.runAction(projectId, assetId, 'copy_relative_path'),
    ).resolves.toBe('assets/logo.png');
  });
});
