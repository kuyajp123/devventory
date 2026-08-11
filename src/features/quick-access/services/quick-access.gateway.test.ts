import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import {
  getAgentReminderUnreadState,
  openAgentUnreadFromQuickAccess,
} from './quick-access.gateway';

describe('quickAccessGateway', () => {
  it('parses the session-only unread state returned by Rust', async () => {
    mockIPC((command) => {
      expect(command).toBe('get_agent_reminder_unread_state');
      return { count: 3, pulse: false, revision: 7 };
    });

    await expect(getAgentReminderUnreadState()).resolves.toEqual({
      count: 3,
      pulse: false,
      revision: 7,
    });
  });

  it('delegates snapshot acknowledgement and navigation to Rust', async () => {
    mockIPC((command, args) => {
      expect(command).toBe('open_agent_unread_from_quick_access');
      expect(args).toEqual({});
    });

    await expect(openAgentUnreadFromQuickAccess()).resolves.toBeUndefined();
  });

  it('rejects invalid unread state at the Tauri boundary', async () => {
    mockIPC(() => ({ count: -1, pulse: 'yes', revision: 1 }));

    await expect(getAgentReminderUnreadState()).rejects.toBeDefined();
  });
});
