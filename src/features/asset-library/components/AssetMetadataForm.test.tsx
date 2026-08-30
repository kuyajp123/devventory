import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Asset } from '../models/asset';
import { AssetMetadataForm } from './AssetMetadataForm';

const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('../hooks/use-assets', () => ({
  useUpdateAssetMetadataMutation: () => ({
    isPending: false,
    mutateAsync: mutation.mutateAsync,
  }),
}));

describe('AssetMetadataForm', () => {
  it('reflects existing tags, note, and favorite status in form inputs', () => {
    const asset: Asset = {
      category: 'document',
      extension: 'txt',
      favorite: true,
      id: '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc',
      mimeType: 'text/plain',
      modifiedAtMs: null,
      name: 'New Text Document.txt',
      note: 'test note content',
      origin: 'discovered',
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      relativePath: 'New Text Document.txt',
      sizeBytes: 0,
      status: 'missing',
      tags: ['config', 'data', 'hero page', 'staging'],
      updatedAt: '2026-08-02T00:00:00.000Z',
      variantIds: [],
    };

    renderWithProviders(<AssetMetadataForm asset={asset} />);

    expect(screen.getByLabelText(/Tags/i)).toHaveValue(
      'config, data, hero page, staging',
    );
    expect(screen.getByLabelText(/Note/i)).toHaveValue('test note content');
    expect(
      screen.getByRole('switch', { name: /Favorite asset/i }),
    ).toBeChecked();
  });

  it('updates form inputs when asset prop changes', () => {
    const assetA: Asset = {
      category: 'document',
      extension: 'txt',
      favorite: false,
      id: '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc',
      mimeType: 'text/plain',
      modifiedAtMs: null,
      name: 'first.txt',
      note: null,
      origin: 'discovered',
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      relativePath: 'first.txt',
      sizeBytes: 0,
      status: 'active',
      tags: [],
      updatedAt: '2026-08-02T00:00:00.000Z',
      variantIds: [],
    };

    const assetB: Asset = {
      ...assetA,
      favorite: true,
      id: '6e7d0d90-1d2e-45b8-be08-83d8b4db14ed',
      name: 'second.txt',
      note: 'second note',
      relativePath: 'second.txt',
      tags: ['alpha', 'beta'],
    };

    const { rerender } = renderWithProviders(
      <AssetMetadataForm asset={assetA} />,
    );

    expect(screen.getByLabelText(/Tags/i)).toHaveValue('');
    expect(screen.getByLabelText(/Note/i)).toHaveValue('');
    expect(
      screen.getByRole('switch', { name: /Favorite asset/i }),
    ).not.toBeChecked();

    rerender(<AssetMetadataForm asset={assetB} />);

    expect(screen.getByLabelText(/Tags/i)).toHaveValue('alpha, beta');
    expect(screen.getByLabelText(/Note/i)).toHaveValue('second note');
    expect(
      screen.getByRole('switch', { name: /Favorite asset/i }),
    ).toBeChecked();
  });

  it('preserves the latest variant relationships when saving other metadata', async () => {
    const user = userEvent.setup();
    const variantId = '02140f34-e3ff-4adf-9609-26f64e4ea316';
    const asset: Asset = {
      category: 'image',
      extension: 'png',
      favorite: false,
      id: '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc',
      mimeType: 'image/png',
      modifiedAtMs: null,
      name: 'logo.png',
      note: null,
      origin: 'managed',
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      relativePath: 'assets/logo.png',
      sizeBytes: 1,
      status: 'active',
      tags: [],
      updatedAt: '2026-08-02T00:00:00.000Z',
      variantIds: [variantId],
    };
    mutation.mutateAsync.mockResolvedValue(asset);
    renderWithProviders(<AssetMetadataForm asset={asset} />);

    await user.click(screen.getByRole('button', { name: 'Save metadata' }));

    expect(mutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ variantIds: [variantId] }),
    );
  });
});
