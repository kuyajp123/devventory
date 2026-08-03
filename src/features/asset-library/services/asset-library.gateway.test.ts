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

  it('requests a bounded server-paginated variant candidate page', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
    mockIPC((command, args) => {
      expect(command).toBe('list_asset_variant_candidates');
      expect(args).toEqual({
        input: {
          assetId,
          excludedIds: [],
          page: 2,
          pageSize: 25,
          projectId,
          scope: 'asset_root',
          search: 'branding/logo',
        },
      });
      return {
        assetRoot: 'assets',
        currentFolder: 'assets/branding',
        hasMore: true,
        items: [],
        page: 2,
        pageSize: 25,
        totalItems: 143,
        totalPages: 6,
      };
    });

    await expect(
      assetLibraryGateway.listVariantCandidates(projectId, assetId, {
        excludedIds: [],
        page: 2,
        pageSize: 25,
        scope: 'asset_root',
        search: 'branding/logo',
      }),
    ).resolves.toMatchObject({ hasMore: true, totalItems: 143 });
  });

  it('resolves an exact manual path and saves only variant relationships', async () => {
    const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
    const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
    const variantId = '02140f34-e3ff-4adf-9609-26f64e4ea316';
    const commands: string[] = [];
    mockIPC((command, args) => {
      commands.push(command);
      if (command === 'resolve_asset_variant_path') {
        expect(args).toEqual({
          input: {
            assetId,
            projectId,
            relativePath: 'assets/branding/logo-dark.png',
            selectedVariantIds: [],
          },
        });
        return variantCandidate(variantId, 'assets/branding/logo-dark.png');
      }
      expect(command).toBe('update_asset_variants');
      expect(args).toEqual({
        input: { assetId, projectId, variantIds: [variantId] },
      });
      return assetResponse(assetId, projectId, [variantId]);
    });

    await assetLibraryGateway.resolveVariantPath(
      projectId,
      assetId,
      'assets/branding/logo-dark.png',
      [],
    );
    await assetLibraryGateway.updateVariants({
      assetId,
      projectId,
      variantIds: [variantId],
    });
    expect(commands).toEqual([
      'resolve_asset_variant_path',
      'update_asset_variants',
    ]);
  });
});

function variantCandidate(id: string, relativePath: string) {
  return {
    category: 'image',
    extension: 'png',
    id,
    name: relativePath.split('/').slice(-1)[0],
    origin: 'discovered',
    reasons: {
      compatibleType: true,
      matchingMetadata: false,
      sameAssetRoot: true,
      sameFolder: true,
      similarName: true,
    },
    relativePath,
    status: 'active',
  };
}

function assetResponse(
  assetId: string,
  projectId: string,
  variantIds: string[],
) {
  return {
    category: 'image',
    extension: 'png',
    favorite: false,
    id: assetId,
    mimeType: 'image/png',
    modifiedAtMs: null,
    name: 'logo.png',
    note: null,
    origin: 'discovered',
    projectId,
    relativePath: 'assets/branding/logo.png',
    sizeBytes: 1,
    status: 'active',
    tags: [],
    updatedAt: '2026-08-02T00:00:00.000Z',
    variantIds,
  };
}
