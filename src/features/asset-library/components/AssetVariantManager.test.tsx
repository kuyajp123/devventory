import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Asset, VariantCandidate } from '../models/asset';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetVariantManager } from './AssetVariantManager';

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    listVariantCandidates: vi.fn(),
    listVariants: vi.fn(),
    resolveVariantPath: vi.fn(),
    updateVariants: vi.fn(),
  },
}));

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
const existing = candidate(
  '02140f34-e3ff-4adf-9609-26f64e4ea316',
  'assets/branding/logo-white.png',
);
const suggested = candidate(
  '96ce4d59-1ea0-4331-9861-e46ef1716214',
  'assets/branding/logo-dark.png',
);
const manual = candidate(
  '32e16852-a8d4-48eb-9b4d-f5c4966ce4ea',
  'assets/branding/logo-mono.svg',
);

describe('AssetVariantManager', () => {
  beforeEach(() => {
    vi.mocked(assetLibraryGateway.listVariants).mockResolvedValue([existing]);
    vi.mocked(assetLibraryGateway.listVariantCandidates).mockResolvedValue({
      assetRoot: 'assets',
      currentFolder: 'assets/branding',
      hasMore: true,
      items: [suggested],
      page: 1,
      pageSize: 25,
      totalItems: 143,
      totalPages: 6,
    });
    vi.mocked(assetLibraryGateway.resolveVariantPath).mockResolvedValue(manual);
    vi.mocked(assetLibraryGateway.updateVariants).mockResolvedValue({
      ...asset,
      variantIds: [suggested.id, manual.id],
    });
  });

  it('adds, removes, manually resolves, and saves a deliberate selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssetVariantManager asset={asset} />);

    await user.click(screen.getByRole('button', { name: 'Manage variants' }));
    expect(
      await screen.findByRole('heading', { name: 'Manage variants' }),
    ).toBeVisible();
    expect(
      screen.getByText(`Current file: ${asset.relativePath}`),
    ).toBeVisible();
    expect(await screen.findByText(existing.relativePath)).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: `Add ${suggested.relativePath}` }),
    );
    await user.click(
      screen.getByRole('button', { name: `Remove ${existing.relativePath}` }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Project-relative file path' }),
      manual.relativePath,
    );
    await user.click(screen.getByRole('button', { name: 'Add path' }));
    await user.click(screen.getByRole('button', { name: 'Save variants' }));

    expect(assetLibraryGateway.resolveVariantPath).toHaveBeenCalledWith(
      projectId,
      assetId,
      manual.relativePath,
      [suggested.id],
    );
    expect(assetLibraryGateway.updateVariants).toHaveBeenCalledWith({
      assetId,
      projectId,
      variantIds: [suggested.id, manual.id],
    });
  }, 15_000);

  it('searches and changes scope without loading the complete inventory', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssetVariantManager asset={asset} />);
    await user.click(screen.getByRole('button', { name: 'Manage variants' }));
    await screen.findByText(suggested.relativePath);

    await user.click(screen.getByRole('button', { name: 'Entire project' }));
    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search variant filename or path',
      }),
      'mobile/logo',
    );

    await waitFor(() =>
      expect(assetLibraryGateway.listVariantCandidates).toHaveBeenCalledWith(
        projectId,
        assetId,
        expect.objectContaining({
          page: 1,
          pageSize: 25,
          scope: 'all',
          search: 'mobile/logo',
        }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(assetLibraryGateway.listVariantCandidates).toHaveBeenCalledWith(
        projectId,
        assetId,
        expect.objectContaining({ page: 2, pageSize: 25 }),
      ),
    );
  });
});

const asset: Asset = {
  category: 'image',
  extension: 'png',
  favorite: false,
  id: assetId,
  mimeType: 'image/png',
  modifiedAtMs: null,
  name: 'logo.png',
  note: null,
  origin: 'managed',
  projectId,
  relativePath: 'assets/branding/logo.png',
  sizeBytes: 1,
  status: 'active',
  tags: ['brand'],
  updatedAt: '2026-08-02T00:00:00.000Z',
  variantIds: [existing.id],
};

function candidate(id: string, relativePath: string): VariantCandidate {
  return {
    category: 'image',
    extension: relativePath.endsWith('.svg') ? 'svg' : 'png',
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
