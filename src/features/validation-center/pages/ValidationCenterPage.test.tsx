import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { validationCenterGateway } from '../services/validation-center.gateway';
import { ValidationCenterPage } from './ValidationCenterPage';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';
const issueId = 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba';

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProjectId: projectId,
    hasProjects: true,
    isHydrating: false,
  }),
}));

vi.mock('@/features/environment-tracker', () => ({
  useEnvironmentsQuery: () => ({
    data: [
      {
        createdAt: '2026-08-08T00:00:00.000Z',
        description: null,
        id: environmentId,
        name: 'Development',
        projectId,
        sortOrder: 0,
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('../services/validation-center.gateway', () => ({
  validationCenterGateway: {
    deleteRule: vi.fn(),
    exportManifest: vi.fn(),
    listIssues: vi.fn(),
    listRules: vi.fn(),
    previewManifest: vi.fn(),
    reorderRules: vi.fn(),
    saveRule: vi.fn(),
    setIssueStatus: vi.fn(),
    summary: vi.fn(),
    validate: vi.fn(),
  },
}));

describe('ValidationCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validationCenterGateway.listRules).mockResolvedValue([]);
    vi.mocked(validationCenterGateway.summary).mockResolvedValue({
      errorIssues: 1,
      health: 'error',
      ignoredIssues: 0,
      infoIssues: 0,
      lastSuccessfulAt: '2026-08-08T00:00:00.000Z',
      openIssues: 1,
      resolvedIssues: 0,
      warningIssues: 0,
    });
    vi.mocked(validationCenterGateway.listIssues).mockResolvedValue({
      items: [issueResponse()],
      page: 1,
      pageSize: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(validationCenterGateway.setIssueStatus).mockResolvedValue(
      issueResponse({ status: 'ignored' }),
    );
    vi.mocked(validationCenterGateway.saveRule).mockResolvedValue(
      ruleResponse(),
    );
    vi.mocked(validationCenterGateway.previewManifest).mockResolvedValue({
      content: 'DATABASE_URL=\n',
      exists: false,
      keyCount: 1,
      relativePath: '.env.example',
    });
    vi.mocked(validationCenterGateway.exportManifest).mockResolvedValue({
      keyCount: 1,
      relativePath: '.env.example',
      replaced: false,
    });
  });

  it('shows persisted issues and lets the user explicitly ignore one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ValidationCenterPage />);

    expect(await screen.findByText('DATABASE_URL')).toBeVisible();
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    await user.click(
      screen.getByRole('button', { name: 'Ignore DATABASE_URL issue' }),
    );

    await waitFor(() =>
      expect(validationCenterGateway.setIssueStatus).toHaveBeenCalledWith(
        projectId,
        issueId,
        'ignored',
      ),
    );
  });

  it('creates a required rule through the accessible rule form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ValidationCenterPage />);

    await user.click(await screen.findByRole('button', { name: 'Add rule' }));
    await user.type(screen.getByLabelText('Environment key'), 'API_URL');
    await user.click(screen.getByRole('checkbox', { name: 'Development' }));
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() =>
      expect(validationCenterGateway.saveRule).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          enabled: true,
          environmentIds: [environmentId],
          keyName: 'API_URL',
          ruleType: 'required',
          severity: 'error',
        }),
      ),
    );
  });

  it('previews and exports only empty-value manifest content', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ValidationCenterPage />);

    await user.click(
      await screen.findByRole('button', { name: 'Export .env.example' }),
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByText('DATABASE_URL=', { exact: false }),
    ).toBeVisible();
    expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export manifest' }));

    await waitFor(() =>
      expect(validationCenterGateway.exportManifest).toHaveBeenCalledWith(
        projectId,
        '.env.example',
        'cancel',
      ),
    );
  });
});

function issueResponse(extra: Record<string, unknown> = {}) {
  return {
    environmentId,
    environmentName: 'Development',
    firstSeenAt: '2026-08-08T00:00:00.000Z',
    id: issueId,
    issueType: 'required_missing' as const,
    keyName: 'DATABASE_URL',
    lastSeenAt: '2026-08-08T00:00:00.000Z',
    lineNumber: null,
    message: "Required key 'DATABASE_URL' is missing.",
    observedName: null,
    projectId,
    resolvedAt: null,
    ruleId: null,
    severity: 'error' as const,
    sourcePath: null,
    status: 'open' as const,
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...extra,
  };
}

function ruleResponse() {
  return {
    createdAt: '2026-08-08T00:00:00.000Z',
    description: null,
    enabled: true,
    environmentIds: [environmentId],
    id: 'c4373b86-1c32-4f96-a315-f5d17089966f',
    keyName: 'API_URL',
    projectId,
    ruleType: 'required' as const,
    severity: 'error' as const,
    sortOrder: 0,
    updatedAt: '2026-08-08T00:00:00.000Z',
  };
}
