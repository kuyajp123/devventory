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

  describe('resting state', () => {
    it('does not show the create source form by default', async () => {
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      expect(
        screen.queryByRole('heading', { name: 'New custom source' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'New custom source' }),
      ).toBeInTheDocument();
    });

    it('shows empty state when no custom sources exist', async () => {
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      expect(
        await screen.findByText(/No custom sources yet/),
      ).toBeInTheDocument();
    });

    it('renders source rows with Custom badge and key counts', async () => {
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', ['SERVICE_ACCOUNT_JSON']),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      expect(await screen.findByText('Deployment secrets')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('1 key')).toBeInTheDocument();
    });
  });

  describe('create source inline', () => {
    it('opens inline creation panel when clicking New custom source', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'New custom source' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'New custom source' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Source name')).toBeInTheDocument();
    });

    it('does not open a second dialog/modal when creating a source', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'New custom source' }),
      );

      // The create panel should be inline, not in a modal/dialog
      const createPanel = await screen.findByRole('heading', {
        name: 'New custom source',
      });
      expect(createPanel.closest('[data-slot="dialog"]')).toBeNull();
    });

    it('closes the creation panel on Cancel', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: 'New custom source' }),
      );
      expect(
        await screen.findByRole('heading', { name: 'New custom source' }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(
        screen.queryByRole('heading', { name: 'New custom source' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'New custom source' }),
      ).toBeInTheDocument();
    });

    it('creates a custom source and refreshes the list on success', async () => {
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

      await user.click(
        screen.getByRole('button', { name: 'New custom source' }),
      );
      await user.type(
        screen.getByLabelText('Source name'),
        'Deployment secrets',
      );
      await user.type(
        screen.getByLabelText('Initial custom key'),
        'signing-key.p12',
      );
      await user.click(screen.getByRole('button', { name: 'Add key' }));
      await user.click(screen.getByRole('button', { name: 'Create source' }));

      await waitFor(() =>
        expect(
          environmentTrackerGateway.createCustomSource,
        ).toHaveBeenCalledWith({
          environmentId: environment.id,
          keyNames: ['signing-key.p12'],
          name: 'Deployment secrets',
          projectId,
        }),
      );
      expect(
        JSON.stringify(
          vi.mocked(environmentTrackerGateway.createCustomSource).mock.calls,
        ),
      ).not.toMatch(/value|content/i);
    });
  });

  describe('accordion', () => {
    it('expands a source when clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', ['SERVICE_ACCOUNT_JSON']),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'Deployment secrets, 1 key',
      });
      await user.click(sourceButton);

      expect(
        await screen.findByText('SERVICE_ACCOUNT_JSON'),
      ).toBeInTheDocument();
    });

    it('collapses a source when clicked again', async () => {
      const user = userEvent.setup();
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', ['SERVICE_ACCOUNT_JSON']),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'Deployment secrets, 1 key',
      });
      await user.click(sourceButton);
      expect(
        await screen.findByText('SERVICE_ACCOUNT_JSON'),
      ).toBeInTheDocument();

      await user.click(sourceButton);
      await waitFor(() =>
        expect(
          screen.queryByText('SERVICE_ACCOUNT_JSON'),
        ).not.toBeInTheDocument(),
      );
    });

    it('shows key count of 0 for empty sources', async () => {
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Empty source', []),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      expect(await screen.findByText(/0 keys/)).toBeInTheDocument();
    });
  });

  describe('add key inline', () => {
    it('shows add key form only after clicking Add key', async () => {
      const user = userEvent.setup();
      const source = customSource('External dependencies', []);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'External dependencies, 0 keys',
      });
      await user.click(sourceButton);

      // Add key form should not be visible initially
      expect(
        screen.queryByPlaceholderText('Enter key name'),
      ).not.toBeInTheDocument();

      // Click Add key to reveal form
      await user.click(screen.getByRole('button', { name: 'Add key' }));
      expect(
        await screen.findByPlaceholderText('Enter key name'),
      ).toBeInTheDocument();
    });

    it('adds a key and hides the form on success', async () => {
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

      const sourceButton = await screen.findByRole('button', {
        name: 'External dependencies, 0 keys',
      });
      await user.click(sourceButton);
      await user.click(screen.getByRole('button', { name: 'Add key' }));

      const keyInput = screen.getByPlaceholderText('Enter key name');
      await user.type(keyInput, 'google-services.json');
      await user.click(screen.getByRole('button', { name: 'Add' }));

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

    it('cancels the add key form', async () => {
      const user = userEvent.setup();
      const source = customSource('External dependencies', []);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'External dependencies, 0 keys',
      });
      await user.click(sourceButton);
      await user.click(screen.getByRole('button', { name: 'Add key' }));
      expect(
        await screen.findByPlaceholderText('Enter key name'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(
        screen.queryByPlaceholderText('Enter key name'),
      ).not.toBeInTheDocument();
    });
  });

  describe('rename source inline', () => {
    it('opens rename from source menu', async () => {
      const user = userEvent.setup();
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', []),
      ]);
      vi.mocked(environmentTrackerGateway.renameCustomSource).mockResolvedValue(
        customSource('Renamed secrets', []),
      );
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await screen.findByText('Deployment secrets');
      await user.click(
        screen.getByRole('button', { name: 'Actions for Deployment secrets' }),
      );
      await user.click(screen.getByText('Rename'));

      const nameInput = await screen.findByLabelText('Custom source name');
      expect(nameInput).toHaveValue('Deployment secrets');
    });

    it('saves the renamed source via existing mutation', async () => {
      const user = userEvent.setup();
      const source = customSource('Deployment secrets', []);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      vi.mocked(environmentTrackerGateway.renameCustomSource).mockResolvedValue(
        { ...source, name: 'Renamed secrets' },
      );
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await screen.findByText('Deployment secrets');
      await user.click(
        screen.getByRole('button', { name: 'Actions for Deployment secrets' }),
      );
      await user.click(screen.getByText('Rename'));

      const nameInput = await screen.findByLabelText('Custom source name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Renamed secrets');
      await user.click(
        screen.getByRole('button', { name: 'Save source name' }),
      );

      await waitFor(() =>
        expect(
          environmentTrackerGateway.renameCustomSource,
        ).toHaveBeenCalledWith({
          environmentId: environment.id,
          name: 'Renamed secrets',
          projectId,
          sourceId: source.id,
        }),
      );
    });

    it('restores original name on cancel', async () => {
      const user = userEvent.setup();
      const source = customSource('Deployment secrets', []);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await screen.findByText('Deployment secrets');
      await user.click(
        screen.getByRole('button', { name: 'Actions for Deployment secrets' }),
      );
      await user.click(screen.getByText('Rename'));

      const nameInput = await screen.findByLabelText('Custom source name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed my mind');

      await user.click(screen.getByRole('button', { name: 'Cancel rename' }));

      await waitFor(() =>
        expect(
          screen.queryByLabelText('Custom source name'),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('delete source', () => {
    it('delete action is available in source menu', async () => {
      const user = userEvent.setup();
      const source = customSource('Deployment secrets', []);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await screen.findByText('Deployment secrets');
      await user.click(
        screen.getByRole('button', { name: 'Actions for Deployment secrets' }),
      );
      expect(
        await screen.findByRole('menuitem', { name: /Delete source/ }),
      ).toBeInTheDocument();
    });
  });

  describe('copy key', () => {
    it('key rows have an actions menu trigger', async () => {
      const user = userEvent.setup();
      const source = customSource('Deployment secrets', [
        'SERVICE_ACCOUNT_JSON',
      ]);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[
            environment,
            { ...environment, id: 'other-env-id', name: 'Development' },
          ]}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'Deployment secrets, 1 key',
      });
      await user.click(sourceButton);

      expect(
        await screen.findByRole('button', {
          name: 'Actions for SERVICE_ACCOUNT_JSON',
        }),
      ).toBeInTheDocument();
    });

    it('does not show copy-key form in resting state', async () => {
      const user = userEvent.setup();
      const environmentsList = [
        environment,
        { ...environment, id: 'other-env-id', name: 'Development' },
      ];
      const source = customSource('Deployment secrets', [
        'SERVICE_ACCOUNT_JSON',
      ]);
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        source,
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={environmentsList}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'Deployment secrets, 1 key',
      });
      await user.click(sourceButton);

      await screen.findByText('SERVICE_ACCOUNT_JSON');
      expect(
        screen.queryByText(/Copy SERVICE_ACCOUNT_JSON to another/),
      ).not.toBeInTheDocument();
    });
  });

  describe('copy source', () => {
    it('does not show copy source form in resting state', async () => {
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', ['SERVICE_ACCOUNT_JSON']),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={[environment]}
          projectId={projectId}
        />,
      );

      await screen.findByText('Deployment secrets');
      expect(
        screen.queryByText(/Copy source to environment/),
      ).not.toBeInTheDocument();
    });

    it('shows copy source inline panel from source menu', async () => {
      const user = userEvent.setup();
      const environmentsList = [
        environment,
        { ...environment, id: 'other-env-id', name: 'Staging' },
      ];
      vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue([
        customSource('Deployment secrets', ['SERVICE_ACCOUNT_JSON']),
      ]);
      renderWithProviders(
        <CustomEnvironmentSourcesPanel
          environment={environment}
          environments={environmentsList}
          projectId={projectId}
        />,
      );

      const sourceButton = await screen.findByRole('button', {
        name: 'Deployment secrets, 1 key',
      });
      await user.click(sourceButton);

      await user.click(
        screen.getByRole('button', { name: 'Actions for Deployment secrets' }),
      );
      await user.click(screen.getByText('Copy to environment'));

      expect(
        await screen.findByText('Copy source to environment'),
      ).toBeInTheDocument();
    });
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
