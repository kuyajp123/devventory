import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetBrowser } from './AssetBrowser';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';

vi.mock('./AssetFileInspector', () => ({
  AssetFileInspector: ({
    file,
    onClose,
  }: {
    file: { name: string };
    onClose: () => void;
  }) => (
    <aside aria-label={`File information for ${file.name}`}>
      <button onClick={onClose} type="button">
        Close file information
      </button>
    </aside>
  ),
}));

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    list: vi.fn(),
  },
}));

describe('AssetBrowser', () => {
  beforeEach(() => {
    vi.mocked(assetLibraryGateway.list).mockResolvedValue({
      items: [
        {
          category: 'image',
          extension: 'png',
          favorite: true,
          id: assetId,
          mimeType: 'image/png',
          modifiedAtMs: 1_786_000_000_000,
          name: 'logo.png',
          note: null,
          origin: 'managed',
          projectId,
          relativePath: 'assets/branding/logo.png',
          sizeBytes: 2048,
          status: 'active',
          tags: ['brand'],
          updatedAt: '2026-08-01T00:00:00.000Z',
          variantIds: [],
        },
      ],
      page: 1,
      pageSize: 30,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('exposes every asset filter and opens selected file information', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssetBrowser projectId={projectId} />);

    expect(
      await screen.findByRole('searchbox', {
        name: 'Search name or relative path',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /Category/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Origin/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Favorites/ })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Extension' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tag' })).toBeVisible();

    await user.click(await screen.findByText('logo.png'));
    expect(
      screen.getByRole('complementary', {
        name: 'File information for logo.png',
      }),
    ).toBeVisible();
  });

  it('applies server-side filters without loading the whole inventory', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssetBrowser projectId={projectId} />);

    await user.type(
      await screen.findByRole('searchbox', {
        name: 'Search name or relative path',
      }),
      'branding',
    );
    await user.type(screen.getByRole('textbox', { name: 'Extension' }), 'png');
    await user.type(screen.getByRole('textbox', { name: 'Tag' }), 'brand');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(assetLibraryGateway.list).toHaveBeenLastCalledWith(
        projectId,
        expect.objectContaining({
          extension: 'png',
          page: 1,
          pageSize: 30,
          search: 'branding',
          tag: 'brand',
        }),
      ),
    );
  });
});
