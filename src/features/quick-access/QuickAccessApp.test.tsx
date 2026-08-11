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

let unreadEventCallback: ((event: { payload: unknown }) => void) | null = null;

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName, callback) => {
    if (eventName === 'agent-reminders:unread-changed') {
      unreadEventCallback = callback;
    }
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
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  setQuickAccessPreventAutoHide: vi.fn().mockResolvedValue(undefined),
}));

describe('QuickAccessApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startDragging.mockResolvedValue(undefined);
    vi.mocked(gateway.getAgentReminderUnreadState).mockResolvedValue({
      count: 0,
      pulse: false,
      revision: 0,
    });
  });

  it('renders custom titlebar and action placeholders', () => {
    render(<QuickAccessApp />);

    expect(screen.getByText('Devventory Quick Access')).toBeInTheDocument();
    expect(screen.getByText('QUICK ACTIONS')).toBeInTheDocument();
    expect(screen.getByText('+ Environment Key')).toBeInTheDocument();
    expect(screen.getByText('+ Quota Window')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('triggers openMainWindowFromQuickAccess when external link button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuickAccessApp />);

    const openBtn = screen.getByRole('button', {
      name: 'Open Devventory main window',
    });
    await user.click(openBtn);

    expect(gateway.openMainWindowFromQuickAccess).toHaveBeenCalledOnce();
  });

  it('triggers hideQuickAccess when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuickAccessApp />);

    const closeBtn = screen.getByRole('button', {
      name: 'Close Quick Access window',
    });
    await user.click(closeBtn);

    expect(gateway.hideQuickAccess).toHaveBeenCalledOnce();
  });

  it('prevents focus-loss auto-hide for the duration of a native window drag', async () => {
    render(<QuickAccessApp />);

    fireEvent.mouseDown(screen.getByRole('banner'), { button: 0 });

    await waitFor(() => {
      expect(gateway.setQuickAccessPreventAutoHide).toHaveBeenCalledWith(true);
      expect(startDragging).toHaveBeenCalledOnce();
    });
    expect(gateway.setQuickAccessPreventAutoHide).not.toHaveBeenCalledWith(
      false,
    );

    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(gateway.setQuickAccessPreventAutoHide).toHaveBeenLastCalledWith(
        false,
      );
    });
  });

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
