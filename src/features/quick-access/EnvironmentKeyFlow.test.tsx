import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentKeyFlow } from './EnvironmentKeyFlow';

const { environmentGateway, selectionGateway } = vi.hoisted(() => ({
  environmentGateway: {
    addCustomKey: vi.fn(),
    list: vi.fn(),
    listCustomSources: vi.fn(),
  },
  selectionGateway: { getLastOpenedProjectId: vi.fn() },
}));

vi.mock('./services/quick-access.gateway', () => ({
  openEnvironmentSettingsFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/environment-tracker', () => ({
  environmentTrackerGateway: environmentGateway,
}));

vi.mock('@/features/projects', () => ({
  projectSelectionGateway: selectionGateway,
}));

describe('EnvironmentKeyFlow', () => {
  const projectId = 'proj-123';
  const envProductionId = 'env-prod';
  const envLocalId = 'env-local';
  const sourceSecretId = 'src-secrets';
  const sourceTestId = 'src-test';

  beforeEach(() => {
    vi.clearAllMocks();
    selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
    environmentGateway.list.mockResolvedValue([
      { id: envProductionId, name: 'Production' },
      { id: envLocalId, name: 'local' },
    ]);
    environmentGateway.listCustomSources.mockImplementation(
      async (_proj, envId) => {
        if (envId === envProductionId) {
          return [{ id: sourceSecretId, name: 'deployment secrets' }];
        }
        if (envId === envLocalId) {
          return [{ id: sourceTestId, name: 'test' }];
        }
        return [];
      },
    );
    environmentGateway.addCustomKey.mockResolvedValue(undefined);
  });

  it('allows selecting and re-confirming the same environment without breaking downstream state', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EnvironmentKeyFlow onClose={onClose} />);

    // Wait for initial load
    expect(await screen.findByDisplayValue('')).toBeInTheDocument(); // Key name input placeholder exists

    // Open environment dropdown
    const envTrigger = screen.getByRole('button', {
      name: 'Choose environment',
    });
    await user.click(envTrigger);

    // Re-click 'Production' (already selected)
    const prodOption = screen.getByRole('button', { name: 'Production' });
    await user.click(prodOption);

    // Key input should remain visible and valid
    expect(screen.getByLabelText('Custom key name')).toBeInTheDocument();
  });

  it('handles 1-option custom source selection and confirms workflow to key input', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EnvironmentKeyFlow onClose={onClose} />);

    // Switch to 'local' environment which only has 1 source ('test')
    const envTrigger = await screen.findByRole('button', {
      name: 'Choose environment',
    });
    await user.click(envTrigger);
    await user.click(screen.getByRole('button', { name: 'local' }));

    // Open Custom Source picker
    const sourceTrigger = await screen.findByRole('button', {
      name: 'Choose custom source',
    });
    await user.click(sourceTrigger);

    // Click the only available option ('test')
    const testOption = screen.getByRole('button', { name: 'test' });
    await user.click(testOption);

    // Key name input should appear
    expect(await screen.findByLabelText('Custom key name')).toBeInTheDocument();
  });

  it('resets custom source and key name when changing to a different environment', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EnvironmentKeyFlow onClose={onClose} />);

    const keyInput = await screen.findByLabelText('Custom key name');
    await user.type(keyInput, 'MY_KEY');

    // Switch environment to 'local'
    const envTrigger = screen.getByRole('button', {
      name: 'Choose environment',
    });
    await user.click(envTrigger);
    await user.click(screen.getByRole('button', { name: 'local' }));

    // Key input should reset
    await waitFor(() => {
      expect(screen.getByLabelText('Custom key name')).toHaveValue('');
    });
  });

  it('submits key name and shows success state, then resets key name on Add another', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EnvironmentKeyFlow onClose={onClose} />);

    const keyInput = await screen.findByLabelText('Custom key name');
    await user.type(keyInput, 'SERVICE_ACCOUNT_JSON');

    const addBtn = screen.getByRole('button', { name: /Add key/i });
    await user.click(addBtn);

    expect(environmentGateway.addCustomKey).toHaveBeenCalledWith({
      environmentId: envProductionId,
      name: 'SERVICE_ACCOUNT_JSON',
      projectId,
      sourceId: sourceSecretId,
    });

    expect(
      await screen.findByText('Environment key added'),
    ).toBeInTheDocument();
    expect(screen.getByText('SERVICE_ACCOUNT_JSON')).toBeInTheDocument();

    // Click 'Add another'
    await user.click(screen.getByRole('button', { name: 'Add another' }));

    // Key input returns empty
    const newKeyInput = await screen.findByLabelText('Custom key name');
    expect(newKeyInput).toHaveValue('');
  });

  it('calls onClose when Done or Back button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<EnvironmentKeyFlow onClose={onClose} />);

    const backBtn = await screen.findByRole('button', {
      name: 'Back to Quick Actions',
    });
    await user.click(backBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
