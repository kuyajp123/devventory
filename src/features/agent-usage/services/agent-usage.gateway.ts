import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  agentAccountSchema,
  agentQuotaSchema,
  agentReminderSchema,
  resetPreviewSchema,
  type ResetPreviewInput,
  type SaveAgentAccountInput,
  type SaveAgentQuotaInput,
} from '../models/agent-usage';

export const agentUsageGateway = {
  async listAccounts() {
    const response = await invokeCommand<unknown>('list_agent_accounts');
    return agentAccountSchema.array().parse(response);
  },

  async saveAccount(input: SaveAgentAccountInput) {
    const response = await invokeCommand<unknown>('save_agent_account', {
      input: {
        ...input,
        customPlatform:
          input.platform === 'custom' ? input.customPlatform.trim() : null,
      },
    });
    return agentAccountSchema.parse(response);
  },

  deleteAccount(id: string) {
    return invokeCommand<void>('delete_agent_account', { input: { id } });
  },

  async saveQuota(input: SaveAgentQuotaInput) {
    const response = await invokeCommand<unknown>('save_agent_quota', {
      input,
    });
    return agentQuotaSchema.parse(response);
  },

  deleteQuota(accountId: string, quotaId: string) {
    return invokeCommand<void>('delete_agent_quota', {
      input: { accountId, quotaId },
    });
  },

  async previewReset(input: ResetPreviewInput) {
    const response = await invokeCommand<unknown>('preview_agent_reset', {
      input,
    });
    return resetPreviewSchema.parse(response);
  },

  async takeDueReminders() {
    const response = await invokeCommand<unknown>('take_due_agent_reminders');
    return agentReminderSchema.array().parse(response);
  },
};
