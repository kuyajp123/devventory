import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Environment, EnvironmentSource } from '../models/environment';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { EnvironmentSourceManager } from './EnvironmentSourceManager';

vi.mock('@/features/projects', () => ({
  useProjectQuery: () => ({
    data: {
      createdAt: '2026-08-01T00:00:00.000Z',
      description: null,
      exclusions: [],
      id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      initialScan: {
        completed: true,
        directoriesVisited: 1,
        durationMs: 1,
        entriesExcluded: 0,
        entriesUnreadable: 0,
        filesDiscovered: 1,
      },
      name: 'Desktop app',
      projectType: 'desktop',
      rootPath: 'C:\\workspace\\app',
      updatedAt: '2026-08-01T00:00:00.000Z',
      watchedLocations: ['.'],
    },
    isError: false,
    isPending: false,
    isSuccess: true,
  }),
}));

vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addSource: vi.fn(),
    delete: vi.fn(),
    deleteSource: vi.fn(),
    listCustomSources: vi.fn(),
    listSources: vi.fn(),
    reorderSources: vi.fn(),
    selectSourceFile: vi.fn(),
    sourceCandidates: vi.fn(),
    unlinkCustomSource: vi.fn(),
    update: vi.fn(),
  },
}));

describe('EnvironmentSourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentTrackerGateway.listSources)
      .mockResolvedValueOnce([])
      .mockResolvedValue([parseIssueSource]);
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue(
      [],
    );
    vi.mocked(environmentTrackerGateway.sourceCandidates).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(environmentTrackerGateway.addSource).mockResolvedValue(
      parseIssueSource,
    );
    vi.mocked(environmentTrackerGateway.update).mockResolvedValue(environment);
    vi.mocked(environmentTrackerGateway.delete).mockResolvedValue(undefined);
  });

  it('counts only file sources and points credential editing to Credential Vault', async () => {
    vi.mocked(environmentTrackerGateway.listSources)
      .mockReset()
      .mockResolvedValue([parseIssueSource]);
    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    const configuredSources = await screen.findByRole('button', {
      name: /Configured Sources/,
    });
    await waitFor(() =>
      expect(configuredSources).toHaveTextContent(/Configured Sources\s*1/),
    );
    expect(
      screen.getByText('Credential sources are managed globally'),
    ).toBeVisible();
  });

  it('renames the environment inline under General Settings', async () => {
    const user = userEvent.setup();
    const onEnvironmentChange = vi.fn();
    vi.mocked(environmentTrackerGateway.update).mockResolvedValue({
      ...environment,
      name: 'Staging API',
    });

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onEnvironmentChange={onEnvironmentChange}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    // Navigate to General section
    await user.click(screen.getByRole('button', { name: 'General' }));

    // Click edit icon button next to name text
    await user.click(
      screen.getByRole('button', {
        name: `Edit name for environment ${environment.name}`,
      }),
    );

    const nameInput = screen.getByLabelText('Environment name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Staging API');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() =>
      expect(environmentTrackerGateway.update).toHaveBeenCalledWith({
        description: environment.description ?? undefined,
        environmentId: environment.id,
        name: 'Staging API',
        projectId: environment.projectId,
      }),
    );
    expect(onEnvironmentChange).toHaveBeenCalledWith({
      ...environment,
      name: 'Staging API',
    });
  });

  it('starts soft deletion from Danger Zone and closes the dialog immediately', async () => {
    const user = userEvent.setup();
    const onStartDeleteEnvironment = vi.fn();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={onOpenChange}
        onStartDeleteEnvironment={onStartDeleteEnvironment}
        projectId={environment.projectId}
      />,
    );

    // Navigate to Danger Zone section
    await user.click(screen.getByRole('button', { name: 'Danger Zone' }));

    await user.click(
      screen.getByRole('button', { name: 'Delete environment' }),
    );

    expect(onStartDeleteEnvironment).not.toHaveBeenCalled();
    expect(screen.getByText(`Delete ${environment.name}?`)).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );

    expect(onStartDeleteEnvironment).toHaveBeenCalledWith(environment);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens a safe, actionable explanation when a newly added source has a parse issue', async () => {
    const user = userEvent.setup();
    vi.mocked(environmentTrackerGateway.selectSourceFile).mockResolvedValue(
      'C:\\workspace\\app\\Backend\\.env',
    );
    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    // Navigate to Add Source section
    await user.click(screen.getByRole('button', { name: 'Add Source' }));
    // Switch to Choose File tab
    await user.click(screen.getByRole('tab', { name: 'Choose File' }));
    // Click Choose file button
    await user.click(screen.getByRole('button', { name: 'Choose file' }));

    await waitFor(() =>
      expect(environmentTrackerGateway.addSource).toHaveBeenCalledWith(
        environment.projectId,
        environment.id,
        'Backend/.env',
      ),
    );
    // Switch back to Configured Sources to see the added item and its issue popover
    await user.click(
      screen.getByRole('button', { name: /Configured Sources/ }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Why Devventory could not parse this file',
      }),
    ).toBeVisible();
    expect(screen.getByText('Line 2')).toBeVisible();
  });

  it('keeps a parsed source green when stale issue metadata is returned after a source update', async () => {
    vi.mocked(environmentTrackerGateway.listSources).mockReset();
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([
      parsedSourceWithStaleIssue,
    ]);

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    const parsedLabel = await screen.findByText('Parsed');
    const parsedChip = parsedLabel.closest('[data-slot="chip"]');

    expect(parsedChip).toHaveAttribute('data-status', 'parsed');
    expect(parsedChip).toHaveClass(
      'chip--success',
      'bg-success/15',
      'text-success',
    );
  });

  it('displays linked vault credential sources with key count and manage button', async () => {
    vi.mocked(environmentTrackerGateway.listSources).mockReset();
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([]);
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
      {
        createdAt: '2026-08-05T00:00:00.000Z',
        environmentId: environment.id,
        id: 'a1b2c3d4-0817-4b8b-ad88-ec19881295b8',
        keys: [
          {
            createdAt: '2026-08-05T00:00:00.000Z',
            environmentId: environment.id,
            id: 'k1',
            name: 'STRIPE_SECRET_KEY',
            normalizedName: 'STRIPE_SECRET_KEY',
            projectId: environment.projectId,
            sourceId: 'a1b2c3d4-0817-4b8b-ad88-ec19881295b8',
            updatedAt: '2026-08-05T00:00:00.000Z',
          },
        ],
        name: 'Stripe Payments',
        projectId: environment.projectId,
        sortOrder: 0,
        updatedAt: '2026-08-05T00:00:00.000Z',
      },
    ]);

    const onOpenCredentialVault = vi.fn();

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenCredentialVault={onOpenCredentialVault}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    expect(await screen.findByText('Stripe Payments')).toBeVisible();
    expect(screen.getByText('1 key linked')).toBeVisible();

    const manageBtn = screen.getByRole('button', { name: /Manage in vault/i });
    await userEvent.click(manageBtn);
    expect(onOpenCredentialVault).toHaveBeenCalledWith(
      'a1b2c3d4-0817-4b8b-ad88-ec19881295b8',
    );
  });

  it('prompts for confirmation before removing a file source', async () => {
    const user = userEvent.setup();
    vi.mocked(environmentTrackerGateway.listSources).mockReset();
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([
      parseIssueSource,
    ]);
    vi.mocked(environmentTrackerGateway.deleteSource).mockResolvedValue(
      undefined,
    );

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    const removeBtn = await screen.findByRole('button', {
      name: `Remove ${parseIssueSource.relativePath}`,
    });
    await user.click(removeBtn);

    expect(
      await screen.findByRole('heading', {
        name: 'Remove Configuration Source',
      }),
    ).toBeVisible();
    expect(screen.getByText(/Are you sure you want to remove/)).toBeVisible();

    const confirmBtn = screen.getByRole('button', { name: 'Remove Source' });
    await user.click(confirmBtn);

    expect(environmentTrackerGateway.deleteSource).toHaveBeenCalledWith(
      environment.projectId,
      environment.id,
      parseIssueSource.id,
    );
  });

  it('prompts for confirmation and unlinks a custom vault source from environment', async () => {
    const user = userEvent.setup();
    vi.mocked(environmentTrackerGateway.listSources).mockReset();
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([]);
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
      {
        createdAt: '2026-08-05T00:00:00.000Z',
        environmentId: environment.id,
        id: 'vault-src-1',
        keys: [
          {
            createdAt: '2026-08-05T00:00:00.000Z',
            environmentId: environment.id,
            id: 'k1',
            name: 'STRIPE_SECRET_KEY',
            normalizedName: 'STRIPE_SECRET_KEY',
            projectId: environment.projectId,
            sourceId: 'vault-src-1',
            updatedAt: '2026-08-05T00:00:00.000Z',
          },
        ],
        name: 'Stripe Payments',
        projectId: environment.projectId,
        sortOrder: 0,
        updatedAt: '2026-08-05T00:00:00.000Z',
      },
    ]);
    vi.mocked(environmentTrackerGateway.unlinkCustomSource).mockResolvedValue(
      undefined,
    );

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    const unlinkBtn = await screen.findByRole('button', {
      name: /Unlink Stripe Payments from this environment/i,
    });
    await user.click(unlinkBtn);

    expect(
      await screen.findByRole('heading', {
        name: 'Unlink Credential Source',
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /The credentials and encrypted secrets in your Credential Vault will not be deleted/,
      ),
    ).toBeVisible();

    const confirmBtn = screen.getByRole('button', { name: 'Unlink Source' });
    await user.click(confirmBtn);

    expect(environmentTrackerGateway.unlinkCustomSource).toHaveBeenCalledWith({
      environmentId: environment.id,
      projectId: environment.projectId,
      sourceId: 'vault-src-1',
    });
  });
});

const environment: Environment = {
  createdAt: '2026-08-05T00:00:00.000Z',
  description: 'Staging configuration',
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Staging',
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const parseIssueSource: EnvironmentSource = {
  createdAt: '2026-08-05T00:00:00.000Z',
  environmentId: environment.id,
  id: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
  lastIssueCode: 'invalid_assignment',
  lastIssueLine: 2,
  lastIssueMessage: 'A configuration assignment could not be parsed.',
  lastObservedModifiedAtMs: 1_785_888_000_000,
  lastObservedSizeBytes: 128,
  lastParsedAt: '2026-08-05T00:00:00.000Z',
  lastSuccessfulParseAt: null,
  parseStatus: 'parse_issue',
  projectId: environment.projectId,
  relativePath: 'Backend/.env',
  sortOrder: 0,
  updatedAt: '2026-08-05T00:00:00.000Z',
};

const parsedSourceWithStaleIssue: EnvironmentSource = {
  ...parseIssueSource,
  id: '4b2cc20c-9360-44b8-85d3-d5f089582d6f',
  lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
  parseStatus: 'parsed',
  relativePath: 'Backend/.env.staging',
};
