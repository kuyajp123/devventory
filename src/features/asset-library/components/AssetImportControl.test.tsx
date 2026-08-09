import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetImportControl } from './AssetImportControl';

const importModalSpy = vi.hoisted(() => vi.fn());

vi.mock('./AssetImportModal', () => ({
  AssetImportModal: (props: {
    initialDestination?: string;
    initialSourcePath: string | null;
  }) => {
    importModalSpy(props);
    return (
      <div role="dialog">
        {props.initialDestination}:{props.initialSourcePath ?? 'picker'}
      </div>
    );
  },
}));

vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    selectSource: vi.fn(),
    subscribeToFileDrops: vi.fn(),
  },
}));

describe('AssetImportControl', () => {
  beforeEach(() => {
    importModalSpy.mockClear();
    vi.mocked(assetLibraryGateway.selectSource).mockResolvedValue(
      'C:\\incoming\\logo.png',
    );
    vi.mocked(assetLibraryGateway.subscribeToFileDrops).mockResolvedValue(
      vi.fn(),
    );
  });

  it('opens the import review with the selected folder as its destination', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AssetImportControl
        destination="assets/branding"
        projectId="30af17bd-2dd6-4b89-a5e7-8517191815a7"
        watchedLocations={['assets']}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Import to assets/branding' }),
    );

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'assets/branding:C:\\incoming\\logo.png',
    );
  });

  it('reviews a native file drop in the selected folder', async () => {
    renderWithProviders(
      <AssetImportControl
        destination="assets/icons"
        projectId="30af17bd-2dd6-4b89-a5e7-8517191815a7"
        watchedLocations={['assets']}
      />,
    );

    const onDrop = vi.mocked(assetLibraryGateway.subscribeToFileDrops).mock
      .calls[0]?.[0];
    expect(onDrop).toBeTypeOf('function');
    act(() => onDrop?.('C:\\incoming\\icon.svg'));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'assets/icons:C:\\incoming\\icon.svg',
    );
  });

  it('disables importing when the selected folder is outside watched locations', () => {
    renderWithProviders(
      <AssetImportControl
        destination="src/components"
        projectId="30af17bd-2dd6-4b89-a5e7-8517191815a7"
        watchedLocations={['assets']}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Import to src/components' }),
    ).toBeDisabled();
  });
});
