import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickAccessApp } from './QuickAccessApp';
import * as gateway from './services/quick-access.gateway';

const { startDragging } = vi.hoisted(() => ({
  startDragging: vi.fn(),
}));
const { environmentGateway, selectionGateway } = vi.hoisted(() => ({
  environmentGateway: {
    addCustomKey: vi.fn(),
    list: vi.fn(),
    listCustomSources: vi.fn(),
  },
  selectionGateway: { getLastOpenedProjectId: vi.fn() },
}));

let unreadEventCallback: ((event: { payload: unknown }) => void) | null = null;

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_eventName, callback) => {
    unreadEventCallback = callback;
    return Promise.resolve(() => {
      unreadEventCallback = null;
    });
  }),
}));

vi.mock('./services/quick-access.gateway', () => ({
  hideQuickAccess: vi.fn().mockResolvedValue(undefined),
  getAgentReminderUnreadState: vi.fn().mockResolvedValue({
    count: 0,
    pulse: false,
    revision: 0,
  }),
  openAgentUnreadFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  openEnvironmentSettingsFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  setQuickAccessMode: vi.fn().mockResolvedValue(undefined),
  setQuickAccessPreventAutoHide: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/environment-tracker', () => ({
  environmentTrackerGateway: environmentGateway,
}));

vi.mock('@/features/projects', () => ({
  projectSelectionGateway: selectionGateway,
}));

describe('QuickAccessApp', () => {
  const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
  const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';
  const environmentId2 = 'a1b2c3d4-1234-5678-abcd-ef0123456789';
  const sourceId = '4b2cc20c-9360-44b8-85d3-d5f089582d6e';

  beforeEach(() => {
    vi.clearAllMocks();
    startDragging.mockResolvedValue(undefined);
    vi.mocked(gateway.getAgentReminderUnreadState).mockResolvedValue({
      count: 0,
      pulse: false,
      revision: 0,
    });
    selectionGateway.getLastOpenedProjectId.mockResolvedValue(null);
    environmentGateway.list.mockResolvedValue([]);
    environmentGateway.listCustomSources.mockResolvedValue([]);
    environmentGateway.addCustomKey.mockResolvedValue(undefined);
  });

  describe('home', () => {
    it('renders the Quick Actions home with both actions', () => {
      render(<QuickAccessApp />);

      expect(screen.getByText('Devventory Quick Access')).toBeInTheDocument();
      expect(screen.getByText('QUICK ACTIONS')).toBeInTheDocument();
      expect(screen.getByText('+ Environment Key')).toBeInTheDocument();
      expect(screen.getByText('+ Quota Window')).toBeInTheDocument();
      expect(screen.getByText('Add')).toBeInTheDocument();
      expect(screen.getAllByText('Coming soon')).toHaveLength(1);
    });

    it('does not show the environment key form on home', () => {
      render(<QuickAccessApp />);

      expect(
        screen.queryByLabelText('Custom key name'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Choose environment'),
      ).not.toBeInTheDocument();
    });

    it('transitions to environment key flow when clicked', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([
        { id: environmentId, name: 'Production' },
      ]);
      environmentGateway.listCustomSources.mockResolvedValue([
        { id: sourceId, name: 'Deployment secrets' },
      ]);

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );

      // Should advance to enter-key since Production has sources
      expect(
        await screen.findByLabelText('Custom key name'),
      ).toBeInTheDocument();
    });
  });

  describe('environment key flow', () => {
    it('advances through environment selection to next step', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([
        { id: environmentId, name: 'Production' },
      ]);
      environmentGateway.listCustomSources.mockResolvedValue([
        { id: sourceId, name: 'Deployment secrets' },
      ]);

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );

      // After loading, should auto-advance to enter-key (Production has sources)
      // Verify by checking for the key name input
      expect(
        await screen.findByLabelText('Custom key name'),
      ).toBeInTheDocument();
    });

    it('shows no-environments state when no environments exist', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([]);

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );

      expect(
        await screen.findByText('No environments yet'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open Environment Tracker' }),
      ).toBeInTheDocument();
    });

    it('shows no-custom-sources state with environment name', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([
        { id: environmentId, name: 'Production' },
      ]);
      environmentGateway.listCustomSources.mockResolvedValue([]);

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );

      expect(
        await screen.findByText(/No custom sources in "Production"/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open Environment Settings' }),
      ).toBeInTheDocument();
    });

    it('opens Environment Settings when no custom sources', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([
        { id: environmentId, name: 'Production' },
      ]);
      environmentGateway.listCustomSources.mockResolvedValue([]);

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );
      await screen.findByText(/No custom sources in "Production"/);

      await user.click(
        screen.getByRole('button', { name: 'Open Environment Settings' }),
      );

      expect(
        gateway.openEnvironmentSettingsFromQuickAccess,
      ).toHaveBeenCalledWith(environmentId);
    });

    it('allows changing environment from no-custom-sources state', async () => {
      const user = userEvent.setup();
      selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
      environmentGateway.list.mockResolvedValue([
        { id: environmentId, name: 'Production' },
        { id: environmentId2, name: 'local' },
      ]);
      environmentGateway.listCustomSources.mockImplementation(
        async (_projId, envId) => {
          if (envId === environmentId2) {
            return [{ id: sourceId, name: 'Local secrets' }];
          }
          return [];
        },
      );

      render(<QuickAccessApp />);
      await user.click(
        screen.getByRole('button', { name: /environment key/i }),
      );

      // Production has no sources - verify the no-custom-sources state
      await screen.findByText(/No custom sources in "Production"/);

      // Change environment - should transition away from no-custom-sources
      await user.click(
        screen.getByRole('button', { name: 'Change environment' }),
      );

      // After changing environment, the "Change environment" button should disappear
      // (we're now in choose-environment or enter-key stage)
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Change environment' }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('header actions', () => {
    it('triggers openMainWindowFromQuickAccess when external link button is clicked', async () => {
      const user = userEvent.setup();
      render(<QuickAccessApp />);

      const openBtn = screen.getByRole('button', {
        name: 'Open Devventory main window',
      });
      await user.click(openBtn);

      expect(gateway.openMainWindowFromQuickAccess).toHaveBeenCalledOnce();
    });

    it('triggers hideQuickAccess when close button is clicked without setting mode to home', async () => {
      const user = userEvent.setup();
      render(<QuickAccessApp />);

      const closeBtn = screen.getByRole('button', {
        name: 'Close Quick Access window',
      });
      await user.click(closeBtn);

      expect(gateway.hideQuickAccess).toHaveBeenCalledOnce();
      expect(gateway.setQuickAccessMode).not.toHaveBeenCalledWith('home');
    });

    it('initiates native window dragging when mouse down occurs on titlebar', async () => {
      render(<QuickAccessApp />);

      fireEvent.mouseDown(screen.getByRole('banner'), { button: 0 });

      await waitFor(() => {
        expect(startDragging).toHaveBeenCalledOnce();
      });
    });
  });

  describe('unread reminders', () => {
    it('shows a solid accessible unread count from the existing Rust snapshot', async () => {
      vi.mocked(gateway.getAgentReminderUnreadState).mockResolvedValue({
        count: 3,
        pulse: false,
        revision: 4,
      });
      const user = userEvent.setup();

      render(<QuickAccessApp />);

      const indicator = await screen.findByRole('button', {
        name: 'Open 3 unread Agent Usage reminders',
      });
      expect(indicator).toHaveTextContent('3');
      expect(indicator).not.toHaveClass('animate-pulse');

      await user.click(indicator);
      expect(gateway.openAgentUnreadFromQuickAccess).toHaveBeenCalledOnce();
    });

    it('pulses only when Rust reports a new reminder while Quick Access is visible', async () => {
      render(<QuickAccessApp />);
      await waitFor(() => expect(unreadEventCallback).not.toBeNull());

      vi.useFakeTimers();
      act(() => {
        unreadEventCallback?.({
          payload: { count: 1, pulse: true, revision: 1 },
        });
      });

      const indicator = screen.getByRole('button', {
        name: 'Open 1 unread Agent Usage reminder',
      });
      expect(indicator).toHaveClass('animate-pulse');

      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(indicator).not.toHaveClass('animate-pulse');
      vi.useRealTimers();
    });

    it('hides the unread indicator when Rust clears the session state', async () => {
      vi.mocked(gateway.getAgentReminderUnreadState).mockResolvedValue({
        count: 2,
        pulse: false,
        revision: 1,
      });
      render(<QuickAccessApp />);
      await screen.findByRole('button', {
        name: 'Open 2 unread Agent Usage reminders',
      });

      act(() => {
        unreadEventCallback?.({
          payload: { count: 0, pulse: false, revision: 2 },
        });
      });

      expect(
        screen.queryByRole('button', { name: /unread Agent Usage reminder/ }),
      ).not.toBeInTheDocument();
    });

    it('ignores stale unread revisions without displaying an old pulse', async () => {
      vi.mocked(gateway.getAgentReminderUnreadState).mockResolvedValue({
        count: 2,
        pulse: false,
        revision: 4,
      });
      render(<QuickAccessApp />);

      const indicator = await screen.findByRole('button', {
        name: 'Open 2 unread Agent Usage reminders',
      });

      act(() => {
        unreadEventCallback?.({
          payload: { count: 1, pulse: true, revision: 3 },
        });
      });

      expect(indicator).toHaveTextContent('2');
      expect(indicator).not.toHaveClass('animate-pulse');
    });

    it('keeps a live pulse when an equal-revision snapshot resolves afterward', async () => {
      let resolveSnapshot:
        | ((
            state: Awaited<
              ReturnType<typeof gateway.getAgentReminderUnreadState>
            >,
          ) => void)
        | undefined;
      vi.mocked(gateway.getAgentReminderUnreadState).mockReturnValue(
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
      );
      render(<QuickAccessApp />);
      await waitFor(() => expect(unreadEventCallback).not.toBeNull());

      act(() => {
        unreadEventCallback?.({
          payload: { count: 1, pulse: true, revision: 1 },
        });
      });
      const indicator = screen.getByRole('button', {
        name: 'Open 1 unread Agent Usage reminder',
      });
      expect(indicator).toHaveClass('animate-pulse');

      resolveSnapshot?.({ count: 1, pulse: false, revision: 1 });
      await waitFor(() => expect(indicator).toHaveClass('animate-pulse'));
    });

    it('makes a pulsing indicator solid when Rust sends a non-pulsing refresh', async () => {
      render(<QuickAccessApp />);
      await waitFor(() => expect(unreadEventCallback).not.toBeNull());

      act(() => {
        unreadEventCallback?.({
          payload: { count: 1, pulse: true, revision: 1 },
        });
      });
      const indicator = screen.getByRole('button', {
        name: 'Open 1 unread Agent Usage reminder',
      });
      expect(indicator).toHaveClass('animate-pulse');

      act(() => {
        unreadEventCallback?.({
          payload: { count: 1, pulse: false, revision: 1 },
        });
      });
      expect(indicator).not.toHaveClass('animate-pulse');
    });
  });
});
