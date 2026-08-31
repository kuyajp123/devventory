import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CredentialVaultPage } from './CredentialVaultPage';
import { credentialVaultViewStore } from '../store/credential-vault-view.store';

const mockNavigate = vi.fn();
const mockSelectProject = vi.fn();

const { idleMutation, vaultMocks } = vi.hoisted(() => ({
  idleMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  vaultMocks: {
    credentials: [] as Array<{
      createdAt: string;
      environmentLinks: Array<{ environmentId: string; projectId: string }>;
      hasValue: boolean;
      id: string;
      key: string;
      normalizedKey: string;
      notes: string | null;
      projectIds: string[];
      sourceId: string;
      updatedAt: string;
    }>,
    environments: [] as Array<{
      createdAt: string;
      description: string | null;
      id: string;
      name: string;
      projectId: string;
      sortOrder: number;
      updatedAt: string;
    }>,
    projects: [] as Array<{ id: string; name: string }>,
    sources: [] as Array<{
      createdAt: string;
      credentialCount: number;
      definitionKey: string | null;
      description: string | null;
      iconPath: string | null;
      id: string;
      name: string;
      projectIds: string[];
      updatedAt: string;
    }>,
    status: { isConfigured: false, isUnlocked: false },
  },
}));

let mockSearchParams = new URLSearchParams();
let mockLocationState: unknown = null;

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLocation: () => ({
      hash: '',
      key: 'default',
      pathname: '/credential-vault',
      search: mockSearchParams.toString()
        ? `?${mockSearchParams.toString()}`
        : '',
      state: mockLocationState,
    }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

vi.mock('@/features/environment-tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/environment-tracker')>()),
  environmentTrackerGateway: {
    list: vi.fn((projectId: string) =>
      Promise.resolve(
        vaultMocks.environments.filter((env) => env.projectId === projectId),
      ),
    ),
  },
}));

vi.mock('@/features/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/projects')>()),
  useActiveProject: () => ({
    activeProject: vaultMocks.projects[0] ?? null,
    activeProjectId: vaultMocks.projects[0]?.id ?? null,
    hasProjects: vaultMocks.projects.length > 0,
    isHydrating: false,
    projectLoadFailed: false,
    projects: vaultMocks.projects,
    selectProject: mockSelectProject,
  }),
  useProjectQuery: (projectId: string) => ({
    data: vaultMocks.projects.find((p) => p.id === projectId) ?? null,
    isError: false,
    isPending: false,
    isSuccess: true,
  }),
  useProjectsQuery: () => ({
    data: vaultMocks.projects,
    isError: false,
    isPending: false,
    isSuccess: true,
  }),
}));

vi.mock('../hooks/use-credential-vault', () => ({
  useCreateCredentialSourceMutation: idleMutation,
  useCreateCredentialsMutation: idleMutation,
  useCredentialSourcesQuery: () => ({
    data: vaultMocks.sources,
    isError: false,
    isPending: false,
  }),
  useCredentialsQuery: () => ({
    data: vaultMocks.credentials,
    isError: false,
    isPending: false,
  }),
  useCredentialVaultStatusQuery: () => ({
    data: vaultMocks.status,
    isError: false,
    isPending: false,
  }),
  useDeleteCredentialMutation: idleMutation,
  useDeleteCredentialSourceMutation: idleMutation,
  useImportEnvSecretsMutation: idleMutation,
  useLockCredentialVaultMutation: idleMutation,
  useRemoveCredentialSecretMutation: idleMutation,
  useReplaceCredentialSecretMutation: idleMutation,
  useUnlockCredentialVaultMutation: idleMutation,
  useUpdateCredentialMutation: idleMutation,
  useUpdateCredentialSourceMutation: idleMutation,
}));

describe('CredentialVaultPage access gate', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockLocationState = null;
    vaultMocks.status = { isConfigured: false, isUnlocked: false };
    vaultMocks.projects = [];
    vaultMocks.sources = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        credentialCount: 1,
        definitionKey: null,
        description: null,
        iconPath: null,
        id: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        name: 'Hidden source metadata',
        projectIds: [],
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
    vaultMocks.credentials = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [],
        hasValue: false,
        id: 'c8664dad-0e57-46dc-b8cf-d46cb1edeb68',
        key: 'HIDDEN_CREDENTIAL_KEY',
        normalizedKey: 'HIDDEN_CREDENTIAL_KEY',
        notes: 'Sensitive metadata',
        projectIds: [],
        sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
  });

  it('hides all vault metadata and actions until first-time setup completes', () => {
    renderWithProviders(<CredentialVaultPage />);

    expect(
      screen.getByRole('dialog', { name: 'Create Credential Vault' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Hidden source metadata'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('HIDDEN_CREDENTIAL_KEY')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New credential' }),
    ).not.toBeInTheDocument();
  });

  it('hides all vault metadata while an existing vault is locked', () => {
    vaultMocks.status = { isConfigured: true, isUnlocked: false };

    renderWithProviders(<CredentialVaultPage />);

    expect(screen.getByText('Credential Vault is locked')).toBeVisible();
    expect(
      screen.queryByText('Hidden source metadata'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('HIDDEN_CREDENTIAL_KEY')).not.toBeInTheDocument();
  });
});

describe('CredentialVaultPage project filtering', () => {
  const projectAlpha = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alpha Project',
  };
  const projectBeta = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Beta Project',
  };

  const sourceAlpha = {
    createdAt: '2026-08-13T00:00:00.000Z',
    credentialCount: 1,
    definitionKey: null,
    description: 'Alpha source description',
    iconPath: null,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Alpha Source',
    projectIds: [projectAlpha.id],
    updatedAt: '2026-08-13T00:00:00.000Z',
  };

  const sourceBeta = {
    createdAt: '2026-08-13T00:00:00.000Z',
    credentialCount: 1,
    definitionKey: null,
    description: 'Beta source description',
    iconPath: null,
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Beta Source',
    projectIds: [projectBeta.id],
    updatedAt: '2026-08-13T00:00:00.000Z',
  };

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockLocationState = null;
    vaultMocks.status = { isConfigured: true, isUnlocked: true };
    vaultMocks.projects = [projectAlpha, projectBeta];
    vaultMocks.sources = [sourceAlpha, sourceBeta];
    vaultMocks.credentials = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [
          {
            environmentId: '77777777-7777-4777-8777-777777777777',
            projectId: projectAlpha.id,
          },
        ],
        hasValue: true,
        id: '55555555-5555-4555-8555-555555555555',
        key: 'ALPHA_API_KEY',
        normalizedKey: 'ALPHA_API_KEY',
        notes: null,
        projectIds: [projectAlpha.id],
        sourceId: sourceAlpha.id,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [
          {
            environmentId: '88888888-8888-4888-8888-888888888888',
            projectId: projectBeta.id,
          },
        ],
        hasValue: true,
        id: '66666666-6666-4666-8666-666666666666',
        key: 'BETA_SECRET',
        normalizedKey: 'BETA_SECRET',
        notes: null,
        projectIds: [projectBeta.id],
        sourceId: sourceBeta.id,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [
          {
            environmentId: '88888888-8888-4888-8888-888888888888',
            projectId: projectBeta.id,
          },
        ],
        hasValue: true,
        id: '99999999-9999-4999-8999-999999999999',
        key: 'BETA_EXTRA_SECRET',
        normalizedKey: 'BETA_EXTRA_SECRET',
        notes: null,
        projectIds: [projectBeta.id],
        sourceId: sourceBeta.id,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
    vaultMocks.environments = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        description: null,
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Alpha Staging',
        projectId: projectAlpha.id,
        sortOrder: 0,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        description: null,
        id: '88888888-8888-4888-8888-888888888888',
        name: 'Beta Production',
        projectId: projectBeta.id,
        sortOrder: 0,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
    credentialVaultViewStore.clear();
  });

  it('displays all sources by default when filter is All', () => {
    renderWithProviders(<CredentialVaultPage />);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
  });

  it('filters sources to only match the selected project and restores all when All is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialVaultPage />);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();

    const projectSelect = screen.getByRole('button', {
      name: /filter by project/i,
    });
    await user.click(projectSelect);

    const alphaOption = await screen.findByRole('option', {
      name: 'Alpha Project',
    });
    await user.click(alphaOption);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).not.toBeInTheDocument();

    await user.click(projectSelect);
    const allOption = await screen.findByRole('option', { name: 'All' });
    await user.click(allOption);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
  });

  it('scopes environment filter options to only the selected project', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialVaultPage />);

    const environmentSelect = screen.getByRole('button', {
      name: /filter by environment/i,
    });
    await user.click(environmentSelect);

    expect(
      await screen.findByRole('option', { name: 'Alpha Staging' }),
    ).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'Beta Production' }),
    ).toBeVisible();

    await user.click(screen.getByRole('option', { name: 'All' }));

    const projectSelect = screen.getByRole('button', {
      name: /filter by project/i,
    });
    await user.click(projectSelect);
    await user.click(
      await screen.findByRole('option', { name: 'Alpha Project' }),
    );

    await user.click(environmentSelect);

    expect(
      await screen.findByRole('option', { name: 'Alpha Staging' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Beta Production' }),
    ).not.toBeInTheDocument();

    // Select Alpha Staging
    await user.click(screen.getByRole('option', { name: 'Alpha Staging' }));

    // Switch to Beta Project: environment filter should reset to All because Alpha Staging is not in Beta
    await user.click(projectSelect);
    await user.click(
      await screen.findByRole('option', { name: 'Beta Project' }),
    );

    await user.click(environmentSelect);
    expect(
      await screen.findByRole('option', { name: 'Beta Production' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Alpha Staging' }),
    ).not.toBeInTheDocument();

    // Reset project filter to All: should restore all environments
    await user.click(screen.getByRole('option', { name: 'All' }));
    await user.click(projectSelect);
    await user.click(await screen.findByRole('option', { name: 'All' }));

    await user.click(environmentSelect);
    expect(
      await screen.findByRole('option', { name: 'Alpha Staging' }),
    ).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'Beta Production' }),
    ).toBeVisible();
  });

  it('filters sources to only match the selected environment and restores all when All is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialVaultPage />);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();

    const environmentSelect = screen.getByRole('button', {
      name: /filter by environment/i,
    });
    await user.click(environmentSelect);

    const alphaOption = await screen.findByRole('option', {
      name: 'Alpha Staging',
    });
    await user.click(alphaOption);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).not.toBeInTheDocument();

    await user.click(environmentSelect);
    const allOption = await screen.findByRole('option', { name: 'All' });
    await user.click(allOption);

    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Beta Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
  });

  it('displays no project empty state when app has no projects and allows adding project or creating source directly', async () => {
    const user = userEvent.setup();
    mockNavigate.mockReset();
    vaultMocks.projects = [];
    vaultMocks.environments = [];
    vaultMocks.sources = [];
    vaultMocks.credentials = [];

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', { name: 'No projects found' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Create a project to organize environment credentials/i),
    ).toBeVisible();

    const addProjectBtn = screen.getByRole('button', { name: 'Add project' });
    await user.click(addProjectBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/projects/new');

    const createSourceBtn = screen.getByRole('button', {
      name: 'Create first source',
    });
    await user.click(createSourceBtn);
    expect(
      await screen.findByRole('dialog', { name: 'Create credential source' }),
    ).toBeVisible();
  });

  it('displays no environment empty state when project has no environments and routes to environment tracker', async () => {
    const user = userEvent.setup();
    mockNavigate.mockReset();
    mockSelectProject.mockReset();
    vaultMocks.projects = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha Project' },
    ];
    vaultMocks.environments = [];
    vaultMocks.sources = [];
    vaultMocks.credentials = [];

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', { name: 'No environments found' }),
    ).toBeVisible();

    const setupEnvBtn = screen.getByRole('button', {
      name: 'Set up environment',
    });
    await user.click(setupEnvBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/environments?create=true', {
      state: { openCreateModal: true },
    });
  });

  it('displays build source of truth empty state when project has environments but no sources yet', async () => {
    vaultMocks.projects = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Alpha Project' },
    ];
    vaultMocks.environments = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        description: null,
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Alpha Staging',
        projectId: '11111111-1111-4111-8111-111111111111',
        sortOrder: 0,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
    vaultMocks.sources = [];
    vaultMocks.credentials = [];

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Build your source of truth',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Create first source' }),
    ).toBeVisible();
  });

  it('displays no matching sources empty state with clear filters button when filters exclude all sources', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialVaultPage />);

    // Search for a non-existent term
    const searchInput = screen.getByLabelText(
      'Search credential sources and keys',
    );
    await user.type(searchInput, 'nonexistentterm12345');

    expect(
      await screen.findByRole('heading', { name: 'No sources match' }),
    ).toBeVisible();

    const clearBtn = screen.getByRole('button', { name: 'Clear filters' });
    await user.click(clearBtn);

    expect(searchInput).toHaveValue('');
    expect(
      screen.getByRole('button', {
        name: (name) =>
          name.includes('Alpha Source') &&
          !name.includes('Edit') &&
          !name.includes('Delete'),
      }),
    ).toBeVisible();
  });

  it('clears the search input when the SearchField clear button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CredentialVaultPage />);

    const searchInput = await screen.findByLabelText(
      'Search credential sources and keys',
    );
    await user.type(searchInput, 'test-query');
    expect(searchInput).toHaveValue('test-query');

    const clearButton = screen.getByRole('button', {
      name: 'Clear credential search',
    });
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('redirects to environment tracker and passes cell highlight parameters when redirection button is clicked', async () => {
    const user = userEvent.setup();
    mockNavigate.mockReset();
    vaultMocks.status = { isConfigured: true, isUnlocked: true };
    vaultMocks.projects = [projectAlpha, projectBeta];
    vaultMocks.sources = [sourceAlpha, sourceBeta];
    vaultMocks.environments = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        description: null,
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Alpha Staging',
        projectId: projectAlpha.id,
        sortOrder: 0,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];
    vaultMocks.credentials = [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [
          {
            environmentId: '77777777-7777-4777-8777-777777777777',
            projectId: projectAlpha.id,
          },
        ],
        hasValue: true,
        id: '55555555-5555-4555-8555-555555555555',
        key: 'ALPHA_API_KEY',
        normalizedKey: 'ALPHA_API_KEY',
        notes: null,
        projectIds: [projectAlpha.id],
        sourceId: sourceAlpha.id,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ];

    renderWithProviders(<CredentialVaultPage />);

    const redirectButton = await screen.findByRole('button', {
      name: 'Open ALPHA_API_KEY in Environment Tracker',
    });
    await user.click(redirectButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/environments?search=ALPHA_API_KEY&env=77777777-7777-4777-8777-777777777777',
      {
        state: {
          highlightCell: {
            environmentId: '77777777-7777-4777-8777-777777777777',
            keyName: 'ALPHA_API_KEY',
          },
        },
      },
    );
  });

  it('pre-selects source and applies project filter when navigated with search parameters', async () => {
    mockSearchParams = new URLSearchParams(
      `source=${sourceBeta.id}&project=${projectBeta.id}`,
    );

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', { name: 'Beta Source' }),
    ).toBeVisible();
    expect(screen.getAllByText('BETA_SECRET').length).toBeGreaterThanOrEqual(1);
  });

  it('pre-selects credential and centers it in view when navigated with credential search parameter', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    mockSearchParams = new URLSearchParams(
      `source=${sourceBeta.id}&credential=66666666-6666-4666-8666-666666666666`,
    );

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', { name: 'Beta Source' }),
    ).toBeVisible();

    await vi.waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });
  });

  it('does not scroll or center the screen when manually clicking a credential in normal browsing', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    mockSearchParams = new URLSearchParams(`source=${sourceBeta.id}`);

    renderWithProviders(<CredentialVaultPage />);

    expect(
      await screen.findByRole('heading', { name: 'Beta Source' }),
    ).toBeVisible();

    // In normal browsing, initial source load without credential search param does not scroll
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    const extraCredentialRow = screen.getByRole('button', {
      name: /BETA_EXTRA_SECRET/i,
    });
    await user.click(extraCredentialRow);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('preserves selected credential key when navigating away and remounting without filters', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<CredentialVaultPage />);

    // Click Beta Source in sources sidebar
    const betaSourceBtn = screen.getByRole('button', {
      name: (name) =>
        name.includes('Beta Source') &&
        !name.includes('Edit') &&
        !name.includes('Delete'),
    });
    await user.click(betaSourceBtn);

    // Click BETA_EXTRA_SECRET credential row
    const betaExtraSecretRow = await screen.findByRole('button', {
      name: /BETA_EXTRA_SECRET/i,
    });
    await user.click(betaExtraSecretRow);

    // Verify right panel shows BETA_EXTRA_SECRET details
    expect(
      screen.getByRole('heading', { name: 'BETA_EXTRA_SECRET' }),
    ).toBeVisible();

    // Unmount (simulating navigating away to another screen)
    unmount();

    // Remount (simulating navigating back to Credential Vault)
    renderWithProviders(<CredentialVaultPage />);

    // Selected credential must remain BETA_EXTRA_SECRET in the right panel and active row
    expect(
      await screen.findByRole('heading', { name: 'BETA_EXTRA_SECRET' }),
    ).toBeVisible();
    expect(credentialVaultViewStore.getViewState().selectedCredentialId).toBe(
      '99999999-9999-4999-8999-999999999999',
    );
    expect(credentialVaultViewStore.getViewState().selectedSourceId).toBe(
      sourceBeta.id,
    );
  });

  it('restores scroll position when remounting without filters', async () => {
    credentialVaultViewStore.setScrollPosition({
      scrollLeft: 0,
      scrollTop: 350,
    });

    renderWithProviders(<CredentialVaultPage />);

    const scrollContainer = await screen.findByTestId(
      'credential-vault-list-scroll',
    );
    expect(scrollContainer.scrollTop).toBe(350);
  });
});
