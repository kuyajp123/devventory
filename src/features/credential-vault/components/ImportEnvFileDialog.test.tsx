import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Project } from '@/features/projects';
import type { Environment } from '@/features/environment-tracker';
import type {
  CredentialSource,
  EnvSecretPreviewItem,
  ImportEnvSecretsResult,
} from '../models/credential-vault';
import { ImportEnvFileDialog } from './ImportEnvFileDialog';
import { credentialVaultGateway } from '../services/credential-vault.gateway';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../services/credential-vault.gateway', () => ({
  credentialVaultGateway: {
    previewEnvSecrets: vi.fn(),
    importEnvFileToVault: vi.fn(),
  },
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

const mockEnvironments: Environment[] = [
  {
    createdAt: '2026-08-01T00:00:00.000Z',
    description: null,
    id: 'env-1',
    name: 'Production',
    projectId: 'proj-1',
    sortOrder: 0,
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const mockSources: CredentialSource[] = [
  {
    createdAt: '2026-08-01T00:00:00.000Z',
    credentialCount: 2,
    definitionKey: null,
    description: null,
    iconPath: null,
    id: 'source-1',
    name: 'Existing Source',
    projectIds: ['proj-1'],
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
];

const mockPreviewItems: EnvSecretPreviewItem[] = [
  {
    existingSourceName: null,
    isAlreadyInVault: false,
    isCommented: false,
    key: 'DATABASE_URL',
    lineNumber: 1,
  },
  {
    existingSourceName: 'Existing Source',
    isAlreadyInVault: true,
    isCommented: false,
    key: 'API_KEY',
    lineNumber: 2,
  },
  {
    existingSourceName: null,
    isAlreadyInVault: false,
    isCommented: true,
    key: 'DISABLED_FLAG',
    lineNumber: 3,
  },
];

describe('ImportEnvFileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(credentialVaultGateway.previewEnvSecrets).mockResolvedValue(
      mockPreviewItems,
    );
  });

  it('renders Step 1 with file selection, yellow banner for commented keys, and preview', async () => {
    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    expect(
      screen.getByText('Import Secrets from .env File'),
    ).toBeInTheDocument();
    expect(screen.getByText('Select File')).toBeInTheDocument();
    expect(screen.getByText('Review Keys')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /Browse File/i }),
    ).toBeInTheDocument();

    // Yellow warning banner for commented keys
    expect(
      await screen.findByText(/1 commented-out variable was detected/i),
    ).toBeInTheDocument();

    // Ready preview card
    expect(await screen.findByText('Ready to review')).toBeInTheDocument();
    expect(screen.getByText(/2 active secrets ready/i)).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeEnabled();
  });

  it('displays red danger banner when duplicate active keys exist and blocks Continue', async () => {
    const duplicateItems: EnvSecretPreviewItem[] = [
      {
        existingSourceName: null,
        isAlreadyInVault: false,
        isCommented: false,
        key: 'PORT',
        lineNumber: 5,
      },
      {
        existingSourceName: null,
        isAlreadyInVault: false,
        isCommented: false,
        key: 'PORT',
        lineNumber: 20,
      },
    ];
    vi.mocked(credentialVaultGateway.previewEnvSecrets).mockResolvedValue(
      duplicateItems,
    );

    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    expect(
      await screen.findByText('Duplicate Active Keys Detected'),
    ).toBeInTheDocument();
    expect(screen.getByText(/on lines 5, 20/i)).toBeInTheDocument();

    // Continue is disabled
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it('allows picking a file via browse dialog in Step 1', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    vi.mocked(open).mockResolvedValue(
      '/projects/devventory/config/.env.production',
    );

    const user = userEvent.setup();
    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    const browseBtn = screen.getByRole('button', { name: /Browse File/i });
    await user.click(browseBtn);

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/projects/devventory',
        directory: false,
        multiple: false,
      }),
    );

    const fileInput = screen.getByLabelText('Relative file path');
    await waitFor(() => {
      expect(fileInput).toHaveValue('config/.env.production');
    });
  });

  it('navigates through 3 steps, reviews keys, and submits destination import', async () => {
    const user = userEvent.setup();
    const mockResult: ImportEnvSecretsResult = {
      importedCount: 2,
      sourceId: 'source-1',
      updatedCount: 0,
    };
    const handleSubmit = vi.fn().mockResolvedValue(mockResult);

    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={handleSubmit}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    // Step 1: Wait for preview and click Continue
    await screen.findByText('Ready to review');
    const step1ContinueBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(step1ContinueBtn);

    // Step 2: Review Keys
    expect(await screen.findByText(/Review Secrets/i)).toBeInTheDocument();
    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.getByText('DISABLED_FLAG')).toBeInTheDocument();
    expect(screen.getByText('Commented (Skipped)')).toBeInTheDocument();
    expect(screen.getByTestId('active-keys-counter')).toHaveTextContent(
      '2 of 2 active secrets selected',
    );

    // Step 2 Continue
    const step2ContinueBtn = screen.getByRole('button', { name: /Continue/i });
    await user.click(step2ContinueBtn);

    // Step 3: Destination
    expect(
      await screen.findByText(/Destination Vault Source/i),
    ).toBeInTheDocument();

    const importBtn = screen.getByRole('button', {
      name: /Import 2 Secrets/i,
    });
    expect(importBtn).toBeEnabled();
    await user.click(importBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          relativePath: '.env',
          selectedKeys: expect.arrayContaining(['DATABASE_URL', 'API_KEY']),
          sourceName: '.env',
        }),
      );
    });

    // Completion State
    expect(await screen.findByText('Import Complete')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('imported')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /View Imported Keys/i }),
    ).toBeInTheDocument();
  });

  it('filters keys with search bar and supports select all / deselect all in Step 2', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    // Navigate to Step 2
    await screen.findByText('Ready to review');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Search filter
    const searchInput = screen.getByPlaceholderText('Filter keys by name…');
    await user.type(searchInput, 'DATA');

    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.queryByText('API_KEY')).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);
    expect(screen.getByText('API_KEY')).toBeInTheDocument();

    // Deselect All
    const deselectBtn = screen.getByRole('button', { name: /Deselect All/i });
    await user.click(deselectBtn);

    // Continue button should now be disabled because 0 keys are selected
    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();

    // Select All
    const selectAllBtn = screen.getByRole('button', { name: /Select All/i });
    await user.click(selectAllBtn);
    expect(continueBtn).toBeEnabled();
  });

  it('preserves state when navigating Back between steps', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    // Step 1 -> Step 2
    await screen.findByText('Ready to review');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2 -> Step 3
    await screen.findByText(/Review Secrets/i);
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3 -> Back to Step 2
    await screen.findByText(/Destination Vault Source/i);
    const backToStep2Btn = screen.getByRole('button', { name: /Back/i });
    await user.click(backToStep2Btn);

    expect(await screen.findByText(/Review Secrets/i)).toBeInTheDocument();

    // Step 2 -> Back to Step 1
    const backToStep1Btn = screen.getByRole('button', { name: /Back/i });
    await user.click(backToStep1Btn);

    expect(
      await screen.findByText('Import Secrets from .env File'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('.env')).toBeInTheDocument();
  });

  it('displays inline error banner inside dialog on submission failure without toast', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi
      .fn()
      .mockRejectedValue(new Error('Stronghold storage failure'));

    renderWithProviders(
      <ImportEnvFileDialog
        environments={mockEnvironments}
        isOpen
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={handleSubmit}
        projects={mockProjects}
        sources={mockSources}
        targetProjectId="proj-1"
      />,
    );

    // Navigate to Step 3
    await screen.findByText('Ready to review');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByText(/Review Secrets/i);
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Submit in Step 3
    const importBtn = screen.getByRole('button', {
      name: /Import 2 Secrets/i,
    });
    await user.click(importBtn);

    // Error alert is displayed inside the dialog
    expect(
      await screen.findByText('Stronghold storage failure'),
    ).toBeInTheDocument();
  });
});
