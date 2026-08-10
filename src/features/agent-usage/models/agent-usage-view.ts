import {
  PLATFORM_LABELS,
  type AgentAccount,
  type AgentAvailability,
  type AgentPlatform,
  type AgentQuota,
} from './agent-usage';

export interface AgentPlatformGroup {
  accounts: AgentAccount[];
  customPlatform: string | null;
  id: string;
  label: string;
  platform: AgentPlatform;
}

export interface AgentUsageCounts extends Record<AgentAvailability, number> {
  total: number;
}

const STATUS_ORDER: Record<AgentAvailability, number> = {
  exhausted: 0,
  limited: 1,
  resetSoon: 2,
  unknown: 3,
  available: 4,
};

export function groupAgentAccounts(
  accounts: AgentAccount[],
): AgentPlatformGroup[] {
  const groups = new Map<string, AgentPlatformGroup>();

  for (const account of accounts) {
    const customPlatform = account.customPlatform?.trim() || null;
    const id =
      account.platform === 'custom'
        ? `custom:${customPlatform?.toLocaleLowerCase() ?? 'other'}`
        : `platform:${account.platform}`;
    const existing = groups.get(id);
    if (existing) {
      existing.accounts.push(account);
      continue;
    }

    groups.set(id, {
      accounts: [account],
      customPlatform,
      id,
      label: customPlatform ?? PLATFORM_LABELS[account.platform],
      platform: account.platform,
    });
  }

  return [...groups.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function countAgentStatuses(accounts: AgentAccount[]): AgentUsageCounts {
  const counts: AgentUsageCounts = {
    available: 0,
    exhausted: 0,
    limited: 0,
    resetSoon: 0,
    total: accounts.length,
    unknown: 0,
  };

  for (const account of accounts) counts[account.availability] += 1;
  return counts;
}

export function sortAgentAccounts(
  accounts: AgentAccount[],
  sort: 'availability' | 'next_reset' | 'platform',
): AgentAccount[] {
  return [...accounts].sort((left, right) => {
    if (sort === 'platform') {
      return platformName(left).localeCompare(platformName(right));
    }
    if (sort === 'next_reset') {
      return resetSort(left.nextResetAt) - resetSort(right.nextResetAt);
    }
    return (
      STATUS_ORDER[left.availability] - STATUS_ORDER[right.availability] ||
      resetSort(left.nextResetAt) - resetSort(right.nextResetAt)
    );
  });
}

export interface ActionableQuotaItem {
  id: string;
  label: string;
  remainingText: string;
  status: 'available' | 'resetSoon';
}

export interface AccountQuotaSummaryResult {
  hasActionableWindows: boolean;
  items: ActionableQuotaItem[];
  label: string;
}

export function accountQuotaSummary(
  account: AgentAccount,
): AccountQuotaSummaryResult {
  if (account.quotas.length === 0) {
    return {
      hasActionableWindows: false,
      items: [],
      label: 'No available windows',
    };
  }

  const availableQuotas = account.quotas.filter(
    (quota) => quota.status === 'available',
  );
  const resetSoonQuotas = account.quotas.filter(
    (quota) => quota.status === 'resetSoon',
  );

  const orderedQuotas = [...availableQuotas, ...resetSoonQuotas];

  if (orderedQuotas.length === 0) {
    return {
      hasActionableWindows: false,
      items: [],
      label: 'No available windows',
    };
  }

  const items: ActionableQuotaItem[] = orderedQuotas.map((quota) => ({
    id: quota.id,
    label: quota.label,
    remainingText: quotaUsageLabel(quota),
    status: quota.status as 'available' | 'resetSoon',
  }));

  return {
    hasActionableWindows: true,
    items,
    label: items[0]
      ? `${items[0].label} · ${items[0].remainingText}`
      : 'No available windows',
  };
}

export function quotaUsageLabel(quota: AgentQuota): string {
  if (quota.remainingPercent == null || quota.usageIsStale) {
    return quota.resetReachedAt
      ? 'Usage not updated after reset'
      : 'Usage remaining unknown';
  }
  return `${quota.remainingPercent}% remaining`;
}

export function platformName(account: AgentAccount): string {
  return account.customPlatform ?? PLATFORM_LABELS[account.platform];
}

function resetSort(value: string | null): number {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}
