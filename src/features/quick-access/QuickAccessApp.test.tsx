import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickAccessApp } from './QuickAccessApp';
import * as gateway from './services/quick-access.gateway';

const { startDragging } = vi.hoisted(() => ({
  startDragging: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}));

vi.mock('./services/quick-access.gateway', () => ({
  hideQuickAccess: vi.fn().mockResolvedValue(undefined),
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  setQuickAccessPreventAutoHide: vi.fn().mockResolvedValue(undefined),
}));

describe('QuickAccessApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startDragging.mockResolvedValue(undefined);
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
});
