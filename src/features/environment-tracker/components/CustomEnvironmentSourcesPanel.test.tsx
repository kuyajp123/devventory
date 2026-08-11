import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { CustomEnvironmentSourcesPanel } from './CustomEnvironmentSourcesPanel';

vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addCustomKey: vi.fn(),
    copyCustomKey: vi.fn(),
    copyCustomSource: vi.fn(),
    createCustomSource: vi.fn(),
    deleteCustomKey: vi.fn(),
    deleteCustomSource: vi.fn(),
    listCustomSources: vi.fn(),
    renameCustomSource: vi.fn(),
  },
}));

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environment = {
  createdAt: '2026-08-11T00:00:00.000Z',
  description: null,
  id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
  name: 'Production',
  projectId,
  sortOrder: 0,
  updatedAt: '2026-08-11T00:00:00.000Z',
};

describe('CustomEnvironmentSourcesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue(
      [],
    );
  });

  it('creates a custom source using key names only and accepts filename-like keys', async () => {
    const user = userEvent.setup();
    vi.mocked(environmentTrackerGateway.createCustomSource).mockResolvedValue(
      customSource('Deployment secrets', ['signing-key.p12']),
    );
    renderWithProviders(
      <CustomEnvironmentSourcesPanel
        environment={environment}
        environments={[environment]}
        projectId={projectId}
      />,
    );

    await user.type(screen.getByLabelText('Source name'), 'Deployment secrets');
    await user.type(
      screen.getByLabelText('Initial custom key'),
      'signing-key.p12',
    );
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.click(
      screen.getByRole('button', { name: 'Create custom source' }),
    );

    await waitFor(() =>
      expect(environmentTrackerGateway.createCustomSource).toHaveBeenCalledWith(
        {
          environmentId: environment.id,
          keyNames: ['signing-key.p12'],
          name: 'Deployment secrets',
          projectId,
        },
      ),
    );
    expect(
      JSON.stringify(
        vi.mocked(environmentTrackerGateway.createCustomSource).mock.calls,
      ),
    ).not.toMatch(/value|content/i);
  });

  it('adds a key to an existing custom source without a secret-value field', async () => {
    const user = userEvent.setup();
    const source = customSource('External dependencies', []);
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
      source,
    ]);
    vi.mocked(environmentTrackerGateway.addCustomKey).mockResolvedValue({
      createdAt: source.createdAt,
      environmentId: environment.id,
      id: 'a8bc92af-6000-4e10-b0ef-926f195c07a2',
      name: 'google-services.json',
      normalizedName: 'GOOGLE-SERVICES.JSON',
      projectId,
      sourceId: source.id,
      updatedAt: source.updatedAt,
    });
    renderWithProviders(
      <CustomEnvironmentSourcesPanel
        environment={environment}
        environments={[environment]}
        projectId={projectId}
      />,
    );

    const keyInput = await screen.findByLabelText(
      'Add key to External dependencies',
    );
    await user.type(keyInput, 'google-services.json');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]);

    await waitFor(() =>
      expect(environmentTrackerGateway.addCustomKey).toHaveBeenCalledWith({
        environmentId: environment.id,
        name: 'google-services.json',
        projectId,
        sourceId: source.id,
      }),
    );
    expect(
      screen.queryByLabelText(/value|secret content/i),
    ).not.toBeInTheDocument();
  });
});

function customSource(name: string, keyNames: string[]) {
  const sourceId = '4b2cc20c-9360-44b8-85d3-d5f089582d6e';
  const createdAt = '2026-08-11T00:00:00.000Z';
  return {
    createdAt,
    environmentId: environment.id,
    id: sourceId,
    keys: keyNames.map((keyName, index) => ({
      createdAt,
      environmentId: environment.id,
      id:
        index === 0
          ? 'a8bc92af-6000-4e10-b0ef-926f195c07a2'
          : '39f15e31-e7b1-47db-b027-c8707551d1d2',
      name: keyName,
      normalizedName: keyName.toLocaleUpperCase(),
      projectId,
      sourceId,
      updatedAt: createdAt,
    })),
    name,
    projectId,
    sortOrder: 0,
    updatedAt: createdAt,
  };
}
