import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetImportModal } from './AssetImportModal';

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    import: vi.fn(),
    preview: vi.fn(),
    selectSource: vi.fn(),
  },
}));

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';

describe('AssetImportModal', () => {
  it('previews a dropped source before sending a managed import', async () => {
    vi.mocked(assetLibraryGateway.preview).mockResolvedValue({
      category: 'image',
      duplicate: null,
      extension: 'png',
      mimeType: 'image/png',
      name: 'logo.png',
      sizeBytes: 2048,
    });
    vi.mocked(assetLibraryGateway.import).mockResolvedValue({
      asset: {
        category: 'image',
        extension: 'png',
        favorite: false,
        id: assetId,
        mimeType: 'image/png',
        modifiedAtMs: 1_786_000_000_000,
        name: 'logo.png',
        note: null,
        origin: 'managed',
        projectId,
        relativePath: 'assets/logo.png',
        sizeBytes: 2048,
        status: 'active',
        tags: [],
        updatedAt: '2026-08-01T00:00:00.000Z',
        variantIds: [],
      },
      duplicate: null,
      status: 'imported',
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter>
        <AssetImportModal
          initialDestination="assets/branding"
          initialSourcePath={String.raw`C:\external\logo.png`}
          isOpen
          onOpenChange={onOpenChange}
          projectId={projectId}
          watchedLocations={['assets']}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Safe metadata preview')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Import and index' }));

    expect(assetLibraryGateway.import).toHaveBeenCalledWith({
      collision: 'cancel',
      destination: 'assets/branding',
      favorite: false,
      filename: undefined,
      note: undefined,
      projectId,
      sourcePath: 'C:\\external\\logo.png',
      tags: [],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
