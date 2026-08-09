import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Environment, EnvironmentSource } from '../models/environment';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { EnvironmentSourceManager } from './EnvironmentSourceManager';

vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addSource: vi.fn(),
    delete: vi.fn(),
    deleteSource: vi.fn(),
    listSources: vi.fn(),
    reorderSources: vi.fn(),
    sourceCandidates: vi.fn(),
    update: vi.fn(),
  },
}));

describe('EnvironmentSourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentTrackerGateway.listSources)
      .mockResolvedValueOnce([])
      .mockResolvedValue([parseIssueSource]);
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

  it('renames the environment directly inside Manage Sources', async () => {
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

  it('confirms and deletes the environment without opening another dialog', async () => {
    const user = userEvent.setup();
    const onEnvironmentDeleted = vi.fn();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onEnvironmentDeleted={onEnvironmentDeleted}
        onOpenChange={onOpenChange}
        projectId={environment.projectId}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Delete environment' }),
    );

    expect(environmentTrackerGateway.delete).not.toHaveBeenCalled();
    expect(screen.getByText(`Delete ${environment.name}?`)).toBeVisible();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    );

    await waitFor(() =>
      expect(environmentTrackerGateway.delete).toHaveBeenCalledWith(
        environment.projectId,
        environment.id,
      ),
    );
    expect(onEnvironmentDeleted).toHaveBeenCalledWith(environment.id);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens a safe, actionable explanation when a newly added source has a parse issue', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EnvironmentSourceManager
        environment={environment}
        onOpenChange={vi.fn()}
        projectId={environment.projectId}
      />,
    );

    await screen.findByText(/No sources yet/);
    await user.type(
      screen.getByLabelText('Project-relative configuration path'),
      'Backend/.env',
    );
    await user.click(screen.getByRole('button', { name: 'Add source' }));

    await waitFor(() =>
      expect(environmentTrackerGateway.addSource).toHaveBeenCalledWith(
        environment.projectId,
        environment.id,
        'Backend/.env',
      ),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Why Devventory could not parse this file',
      }),
    ).toBeVisible();
    expect(screen.getByText('Line 2')).toBeVisible();
    expect(
      screen.getByText('A configuration assignment could not be parsed.'),
    ).toBeVisible();
    expect(
      screen.getByText(/Use KEY=value on every non-empty line/),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Configuration values remain hidden and are never saved/,
      ),
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', {
          name: 'Why Devventory could not parse this file',
        }),
      ).not.toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Explain parse issue for Backend/.env',
      }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Why Devventory could not parse this file',
      }),
    ).toBeVisible();
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
    expect(
      screen.queryByRole('button', {
        name: 'Explain parsed for Backend/.env.staging',
      }),
    ).not.toBeInTheDocument();
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
