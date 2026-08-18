import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CredentialSourceDialog } from './CredentialSourceDialog';
import type { Project } from '@/features/projects';
import type { CredentialSource } from '../models/credential-vault';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((filePath: string) => `asset://localhost/${filePath}`),
}));

const mockProjects: Project[] = [
  {
    createdAt: '2026-08-01T00:00:00.000Z',
    description: null,
    exclusions: [],
    id: 'proj-1',
    initialScan: {
      completed: true,
      directoriesVisited: 1,
      durationMs: 10,
      entriesExcluded: 0,
      entriesUnreadable: 0,
      filesDiscovered: 5,
    },
    name: 'Devventory',
    projectType: 'desktop',
    rootPath: '/projects/devventory',
    updatedAt: '2026-08-01T00:00:00.000Z',
    watchedLocations: [],
  },
];

describe('CredentialSourceDialog image preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays image preview when a custom icon is chosen', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue(
      'C:\\Users\\Paul\\OneDrive\\Pictures\\bg.jpg',
    );

    const user = userEvent.setup();
    renderWithProviders(
      <CredentialSourceDialog
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        source={null}
      />,
    );

    // Initial state: No image preview, "Choose image" button available
    expect(
      screen.queryByAltText('Custom icon preview'),
    ).not.toBeInTheDocument();
    const chooseButton = screen.getByRole('button', { name: 'Choose image' });
    expect(chooseButton).toBeVisible();

    // Click Choose image
    await user.click(chooseButton);

    // Preview should now be displayed
    const previewImg = await screen.findByAltText('Custom icon preview');
    expect(previewImg).toBeVisible();
    expect(previewImg).toHaveAttribute(
      'src',
      'asset://localhost/C:\\Users\\Paul\\OneDrive\\Pictures\\bg.jpg',
    );
    expect(screen.getByText('bg.jpg')).toBeVisible();
    expect(
      screen.getByText('C:\\Users\\Paul\\OneDrive\\Pictures\\bg.jpg'),
    ).toBeVisible();
    expect(screen.getByText('New image selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change image' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeVisible();
  });

  it('allows removing the chosen custom icon', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue('/path/to/my-icon.png');

    const user = userEvent.setup();
    renderWithProviders(
      <CredentialSourceDialog
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        source={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Choose image' }));
    expect(await screen.findByAltText('Custom icon preview')).toBeVisible();

    // Click Remove image
    await user.click(screen.getByRole('button', { name: 'Remove image' }));

    // Preview is removed, "Choose image" button restored
    expect(
      screen.queryByAltText('Custom icon preview'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('my-icon.png')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeVisible();
  });

  it('displays existing icon preview when editing a source with iconPath', async () => {
    const existingSource: CredentialSource = {
      createdAt: '2026-08-01T00:00:00.000Z',
      credentialCount: 0,
      definitionKey: 'custom',
      description: 'Custom source with icon',
      iconPath: '/app-data/icons/existing-logo.png',
      id: 'source-1',
      name: 'My Custom Source',
      projectIds: ['proj-1'],
      updatedAt: '2026-08-01T00:00:00.000Z',
    };

    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <CredentialSourceDialog
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        projects={mockProjects}
        source={existingSource}
      />,
    );

    // Should display the existing icon preview
    const previewImg = screen.getByAltText('Custom icon preview');
    expect(previewImg).toBeVisible();
    expect(previewImg).toHaveAttribute(
      'src',
      'asset://localhost//app-data/icons/existing-logo.png',
    );
    expect(screen.getByText('existing-logo.png')).toBeVisible();
    expect(screen.getByText('Current icon')).toBeVisible();

    // Removing the existing icon
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(
      screen.queryByAltText('Custom icon preview'),
    ).not.toBeInTheDocument();

    // Saving should pass removeIcon: true
    await user.click(screen.getByRole('button', { name: 'Save source' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Custom Source',
        removeIcon: true,
      }),
    );
  });

  it('handles image loading error gracefully', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue('/invalid/corrupted.jpg');

    const user = userEvent.setup();
    renderWithProviders(
      <CredentialSourceDialog
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        source={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Choose image' }));
    const img = await screen.findByAltText('Custom icon preview');

    // Trigger error on image
    fireEvent.error(img);

    // Image fallback icon / message is displayed
    expect(
      screen.queryByAltText('Custom icon preview'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('corrupted.jpg')).toBeVisible();
  });
});
