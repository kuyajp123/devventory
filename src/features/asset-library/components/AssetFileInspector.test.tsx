import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Asset, VariantCandidate } from '../models/asset';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetFileInspector } from './AssetFileInspector';

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    get: vi.fn(),
    listVariantCandidates: vi.fn(),
    listVariants: vi.fn(),
    resolveVariantPath: vi.fn(),
    runAction: vi.fn(),
    updateMetadata: vi.fn(),
    updateVariants: vi.fn(),
  },
}));

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
const variant = candidate(
  '02140f34-e3ff-4adf-9609-26f64e4ea316',
  'assets/branding/logo-dark.png',
);

const asset: Asset = {
  category: 'image',
  extension: 'png',
  favorite: true,
  id: assetId,
  mimeType: 'image/png',
  modifiedAtMs: 1_786_000_000_000,
  name: 'logo.png',
  note: 'Primary application logo',
  origin: 'managed',
  projectId,
  relativePath: 'assets/branding/logo.png',
  sizeBytes: 2048,
  status: 'active',
  tags: ['brand', 'approved'],
  updatedAt: '2026-08-01T00:00:00.000Z',
  variantIds: [variant.id],
};

describe('AssetFileInspector', () => {
  beforeEach(() => {
    vi.mocked(assetLibraryGateway.get).mockResolvedValue(asset);
    vi.mocked(assetLibraryGateway.listVariants).mockResolvedValue([variant]);
    vi.mocked(assetLibraryGateway.listVariantCandidates).mockResolvedValue({
      assetRoot: 'assets',
      currentFolder: 'assets/branding',
      hasMore: false,
      items: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('shows file, asset metadata, actions, and saved variants in the inspector', async () => {
    renderWithProviders(
      <AssetFileInspector
        file={{
          category: 'image',
          extension: 'png',
          id: assetId,
          mimeType: 'image/png',
          modifiedAtMs: asset.modifiedAtMs,
          name: asset.name,
          projectId,
          relativePath: asset.relativePath,
          sizeBytes: asset.sizeBytes,
          status: 'active',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole('complementary', {
        name: 'File information for logo.png',
      }),
    ).toBeVisible();
    expect(screen.getByText(asset.relativePath)).toBeVisible();
    expect(await screen.findByText('Managed')).toBeVisible();
    expect(screen.getByText('brand')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open' })).toBeVisible();
    expect(screen.getByText(variant.relativePath)).toBeVisible();
  });

  it('opens metadata and variant management as focused dialogs', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AssetFileInspector
        file={{
          category: 'image',
          extension: 'png',
          id: assetId,
          mimeType: 'image/png',
          modifiedAtMs: asset.modifiedAtMs,
          name: asset.name,
          projectId,
          relativePath: asset.relativePath,
          sizeBytes: asset.sizeBytes,
          status: 'active',
        }}
        onClose={vi.fn()}
      />,
    );

    await screen.findByText('Primary application logo');
    await user.click(screen.getByRole('button', { name: 'Edit metadata' }));
    expect(
      screen.getByRole('dialog', { name: 'Edit asset metadata' }),
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Manage variants' }));
    expect(
      screen.getByRole('dialog', { name: 'Manage variants' }),
    ).toBeVisible();
  });
});

function candidate(id: string, relativePath: string): VariantCandidate {
  return {
    category: 'image',
    extension: 'png',
    id,
    name: relativePath.split('/').slice(-1)[0] ?? relativePath,
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
