import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentUsageReminderSync } from './AgentUsageReminderSync';
import { useDueAgentRemindersQuery } from '../hooks/use-agent-usage';

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));

vi.mock('@heroui/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@heroui/react')>()),
  toast: { warning },
}));

vi.mock('../hooks/use-agent-usage', () => ({
  useDueAgentRemindersQuery: vi.fn(),
}));

describe('AgentUsageReminderSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows reset-day and reached reminders once per persisted occurrence', () => {
    vi.mocked(useDueAgentRemindersQuery).mockReturnValue({
      data: [
        reminder('resetDay'),
        reminder('resetReached'),
        reminder('beforeReset'),
      ],
    } as ReturnType<typeof useDueAgentRemindersQuery>);

    const view = render(<AgentUsageReminderSync />);
    expect(warning).toHaveBeenCalledTimes(3);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('resets today'),
    );
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('reset time has been reached'),
    );
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('resets in about 6 hours'),
    );

    view.rerender(<AgentUsageReminderSync />);
    expect(warning).toHaveBeenCalledTimes(3);
  });
});

function reminder(kind: 'beforeReset' | 'resetDay' | 'resetReached') {
  return {
    accountId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
    customPlatform: null,
    id:
      kind === 'resetDay'
        ? '95c75ec7-7a82-4a8c-b3e4-47f70bfd54c9'
        : kind === 'resetReached'
          ? '3ac09973-9565-4944-b93a-16db8e845a33'
          : '11111111-2222-3333-4444-555555555555',
    identifier: 'paul@example.com',
    kind,
    platform: 'codex' as const,
    quotaLabel: 'Weekly',
    quotaWindowId: 'e49c4e06-a95f-481d-a456-9dd066591067',
    resetAt: '2026-08-14T12:00:00Z',
    scheduledFor: '2026-08-14T06:00:00Z',
  };
}
