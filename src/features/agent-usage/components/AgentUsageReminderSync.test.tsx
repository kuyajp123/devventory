import { renderWithProviders } from '@/test/render';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { agentUsageGateway } from '../services/agent-usage.gateway';
import { AgentUsageReminderSync } from './AgentUsageReminderSync';

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/agent-usage.gateway', () => ({
  agentUsageGateway: {
    acknowledgeReminders: vi.fn(),
  },
}));

let eventCallback: ((event: { payload: unknown }) => Promise<void>) | null =
  null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName, cb) => {
    if (eventName === 'agent-reminders:in-app') {
      eventCallback = cb;
    }
    return Promise.resolve(() => {
      eventCallback = null;
    });
  }),
}));

describe('AgentUsageReminderSync', () => {
  it('submits delivered outcomes when agent-reminders:in-app event is received', async () => {
    vi.mocked(agentUsageGateway.acknowledgeReminders).mockResolvedValue(
      undefined,
    );

    renderWithProviders(<AgentUsageReminderSync />);

    await waitFor(() => expect(eventCallback).not.toBeNull());

    const payload = {
      batch: {
        batchToken: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        reminders: [
          {
            accountId: 'acc-1',
            customPlatform: null,
            id: 'rem-1',
            identifier: 'paul@example.com',
            kind: 'resetReached',
            platform: 'codex',
            quotaLabel: 'Weekly',
            quotaWindowId: 'qw-1',
            resetAt: '2026-08-10T12:00:00Z',
            scheduledFor: '2026-08-10T12:00:00Z',
          },
        ],
      },
      dispatchId: 'disp-123',
    };

    await eventCallback!({ payload });

    await waitFor(() =>
      expect(agentUsageGateway.acknowledgeReminders).toHaveBeenCalledWith(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        [{ id: 'rem-1', status: 'delivered' }],
      ),
    );
  });
});
