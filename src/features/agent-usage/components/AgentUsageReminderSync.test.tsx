import { renderWithProviders } from '@/test/render';
import { toast } from '@heroui/react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentUsageGateway } from '../services/agent-usage.gateway';
import { navigationIntentStore } from '../services/navigation-intent.store';
import { AgentUsageReminderSync } from './AgentUsageReminderSync';

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/agent-usage.gateway', () => ({
  agentUsageGateway: {
    acknowledgeReminders: vi.fn(),
    acknowledgeUnreadReminders: vi.fn(),
  },
}));

let eventCallback: ((event: { payload: unknown }) => Promise<void>) | null =
  null;
let navigationCallback: ((event: { payload: unknown }) => void) | null = null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName, cb) => {
    if (eventName === 'agent-reminders:in-app') {
      eventCallback = cb;
    } else if (eventName === 'agent-reminders:navigate') {
      navigationCallback = cb;
    }
    return Promise.resolve(() => {
      eventCallback = null;
    });
  }),
}));

describe('AgentUsageReminderSync', () => {
  beforeEach(() => {
    navigationIntentStore.clear();
    mockNavigate.mockClear();
    vi.mocked(agentUsageGateway.acknowledgeUnreadReminders).mockResolvedValue(
      undefined,
    );
    vi.spyOn(toast, 'warning').mockReturnValue('toast-id');
  });

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
            accountId: '11111111-1111-4111-8111-111111111111',
            customPlatform: null,
            id: '22222222-2222-4222-8222-222222222222',
            identifier: 'paul@example.com',
            kind: 'resetReached',
            platform: 'codex',
            quotaLabel: 'Weekly',
            quotaWindowId: '33333333-3333-4333-8333-333333333333',
            resetAt: '2026-08-10T12:00:00Z',
            scheduledFor: '2026-08-10T12:00:00Z',
          },
        ],
      },
      dispatchId: '55555555-5555-4555-8555-555555555555',
    };

    await eventCallback!({ payload });

    await waitFor(() =>
      expect(agentUsageGateway.acknowledgeReminders).toHaveBeenCalledWith(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        [
          {
            id: '22222222-2222-4222-8222-222222222222',
            status: 'delivered',
          },
        ],
      ),
    );
    expect(agentUsageGateway.acknowledgeUnreadReminders).not.toHaveBeenCalled();
    expect(navigationIntentStore.peekIntent()).toBeNull();
  });

  it('acknowledges exact reminder IDs and navigates only when the toast action is pressed', async () => {
    vi.mocked(agentUsageGateway.acknowledgeReminders).mockResolvedValue(
      undefined,
    );
    renderWithProviders(<AgentUsageReminderSync />);
    await waitFor(() => expect(eventCallback).not.toBeNull());

    await eventCallback!({
      payload: {
        batch: {
          batchToken: '44444444-4444-4444-8444-444444444444',
          reminders: [
            {
              accountId: '11111111-1111-4111-8111-111111111111',
              customPlatform: null,
              id: '22222222-2222-4222-8222-222222222222',
              identifier: 'paul@example.com',
              kind: 'resetReached',
              platform: 'codex',
              quotaLabel: 'Weekly',
              quotaWindowId: '33333333-3333-4333-8333-333333333333',
              resetAt: '2026-08-10T12:00:00Z',
              scheduledFor: '2026-08-10T12:00:00Z',
            },
          ],
        },
        dispatchId: '55555555-5555-4555-8555-555555555555',
      },
    });

    const options = vi.mocked(toast.warning).mock.calls[0]?.[1];
    expect(options?.actionProps?.children).toBe('View quota');
    options?.actionProps?.onPress?.({} as never);

    await waitFor(() =>
      expect(agentUsageGateway.acknowledgeUnreadReminders).toHaveBeenCalledWith(
        ['22222222-2222-4222-8222-222222222222'],
      ),
    );
    expect(navigationIntentStore.peekIntent()).toEqual({
      accountId: '11111111-1111-4111-8111-111111111111',
      quotaWindowId: '33333333-3333-4333-8333-333333333333',
      type: 'individual',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/agent-usage');
  });

  it('reuses the existing targeted navigation intent emitted by Quick Access', async () => {
    renderWithProviders(<AgentUsageReminderSync />);
    await waitFor(() => expect(navigationCallback).not.toBeNull());

    navigationCallback!({
      payload: {
        accountId: '11111111-1111-4111-8111-111111111111',
        quotaWindowId: '33333333-3333-4333-8333-333333333333',
        type: 'individual',
      },
    });

    expect(navigationIntentStore.peekIntent()).toEqual({
      accountId: '11111111-1111-4111-8111-111111111111',
      quotaWindowId: '33333333-3333-4333-8333-333333333333',
      type: 'individual',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/agent-usage');
  });

  it('acknowledges a burst snapshot by ID and opens general Agent Usage', async () => {
    vi.mocked(agentUsageGateway.acknowledgeReminders).mockResolvedValue(
      undefined,
    );
    renderWithProviders(<AgentUsageReminderSync />);
    await waitFor(() => expect(eventCallback).not.toBeNull());

    const firstReminder = {
      accountId: '11111111-1111-4111-8111-111111111111',
      customPlatform: null,
      id: '22222222-2222-4222-8222-222222222222',
      identifier: 'paul@example.com',
      kind: 'resetReached',
      platform: 'codex',
      quotaLabel: 'Weekly',
      quotaWindowId: '33333333-3333-4333-8333-333333333333',
      resetAt: '2026-08-10T12:00:00Z',
      scheduledFor: '2026-08-10T12:00:00Z',
    };
    const secondReminder = {
      ...firstReminder,
      accountId: '66666666-6666-4666-8666-666666666666',
      id: '77777777-7777-4777-8777-777777777777',
      identifier: 'work@example.com',
      quotaWindowId: '88888888-8888-4888-8888-888888888888',
    };

    await eventCallback!({
      payload: {
        batch: {
          batchToken: '44444444-4444-4444-8444-444444444444',
          reminders: [firstReminder, secondReminder],
        },
        dispatchId: '55555555-5555-4555-8555-555555555555',
      },
    });

    const options = vi.mocked(toast.warning).mock.calls[0]?.[1];
    expect(options?.actionProps?.children).toBe('View reminders');
    options?.actionProps?.onPress?.({} as never);

    await waitFor(() =>
      expect(agentUsageGateway.acknowledgeUnreadReminders).toHaveBeenCalledWith(
        [firstReminder.id, secondReminder.id],
      ),
    );
    expect(navigationIntentStore.peekIntent()).toEqual({ type: 'burst' });
    expect(mockNavigate).toHaveBeenCalledWith('/agent-usage');
  });
});
