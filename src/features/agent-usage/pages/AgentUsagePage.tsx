import {
  Alert,
  Button,
  Card,
  EmptyState,
  Skeleton,
  toast,
} from '@heroui/react';
import { IconPlus, IconRobot } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ConfirmDialog } from '@/shared/ui';
import { AgentAccountDialog } from '../components/AgentAccountDialog';
import { AgentPlatformGroup } from '../components/AgentPlatformGroup';
import { AgentQuotaDialog } from '../components/AgentQuotaDialog';
import { navigationIntentStore } from '../services/navigation-intent.store';
import {
  type AgentPlatformFilter,
  type AgentSortOption,
  type AgentStatusFilter,
  AgentUsageToolbar,
} from '../components/AgentUsageToolbar';
import { AgentUsageSummary } from '../components/AgentUsageSummary';
import {
  useAgentAccountsQuery,
  useDeleteAgentAccountMutation,
  useDeleteAgentQuotaMutation,
  useSaveAgentAccountMutation,
  useSaveAgentQuotaMutation,
} from '../hooks/use-agent-usage';
import {
  SIGN_IN_METHOD_LABELS,
  type AgentAccount,
  type AgentAccountFormValues,
  type AgentPlatform,
  type AgentQuota,
  type AgentQuotaSaveError,
  type SaveAgentQuotaInput,
} from '../models/agent-usage';
import {
  groupAgentAccounts,
  platformName,
  sortAgentAccounts,
} from '../models/agent-usage-view';

type DeleteTarget =
  | { account: AgentAccount; kind: 'account' }
  | { account: AgentAccount; kind: 'quota'; quota: AgentQuota };

interface InitialPlatform {
  customPlatform: string | null;
  platform: AgentPlatform;
}

export function AgentUsagePage() {
  const accounts = useAgentAccountsQuery();
  const saveAccount = useSaveAgentAccountMutation();
  const deleteAccount = useDeleteAgentAccountMutation();
  const saveQuota = useSaveAgentQuotaMutation();
  const deleteQuota = useDeleteAgentQuotaMutation();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<AgentPlatformFilter>('all');
  const [status, setStatus] = useState<AgentStatusFilter>('all');
  const [sort, setSort] = useState<AgentSortOption>('availability');
  const [platformExpansion, setPlatformExpansion] = useState<
    Record<string, boolean>
  >({});
  const [editingAccount, setEditingAccount] = useState<AgentAccount | null>(
    null,
  );
  const [initialPlatform, setInitialPlatform] =
    useState<InitialPlatform | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [quotaAccount, setQuotaAccount] = useState<AgentAccount | null>(null);
  const [editingQuota, setEditingQuota] = useState<AgentQuota | null>(null);
  const [quotaSaveError, setQuotaSaveError] =
    useState<AgentQuotaSaveError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [highlightedQuotaId, setHighlightedQuotaId] = useState<string | null>(
    null,
  );
  const accountItems = useMemo(() => accounts.data ?? [], [accounts.data]);

  // Process incoming notification navigation intent
  useEffect(() => {
    if (!accounts.data) return;
    const intent = navigationIntentStore.getAndClearIntent();
    if (!intent) return;

    if (intent.type === 'individual') {
      const targetAccount = accounts.data.find(
        (a) => a.id === intent.accountId,
      );
      if (!targetAccount) {
        toast.warning('This notification target is no longer available.');
        return;
      }
      // Expand target group
      const targetGroup = groupAgentAccounts([targetAccount])[0];
      if (targetGroup) {
        setTimeout(() => {
          setPlatformExpansion((current) => ({
            ...current,
            [targetGroup.id]: true,
          }));
        }, 0);
      }
      const targetQuota = targetAccount.quotas.find(
        (q) => q.id === intent.quotaWindowId,
      );
      if (!targetQuota) {
        toast.warning('This quota window is no longer available.');
        return;
      }

      setTimeout(() => {
        setHighlightedQuotaId(targetQuota.id);
      }, 0);
      const timer = setTimeout(() => {
        setHighlightedQuotaId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [accounts.data]);
  const visibleAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = accountItems
      .filter((account) => platform === 'all' || account.platform === platform)
      .filter((account) => status === 'all' || account.availability === status)
      .filter((account) => {
        if (!normalizedSearch) return true;
        return [
          account.identifier,
          platformName(account),
          SIGN_IN_METHOD_LABELS[account.signInMethod],
        ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      });
    return sortAgentAccounts(filtered, sort);
  }, [accountItems, platform, search, sort, status]);
  const platformGroups = useMemo(
    () => groupAgentAccounts(visibleAccounts),
    [visibleAccounts],
  );

  async function submitAccount(values: AgentAccountFormValues) {
    try {
      await saveAccount.mutateAsync({
        ...values,
        ...(editingAccount ? { id: editingAccount.id } : {}),
      });
      toast.success(editingAccount ? 'Account updated' : 'Account added');
      setIsAccountOpen(false);
      setEditingAccount(null);
      setInitialPlatform(null);
    } catch (error) {
      toast.danger(safeError(error, 'The account could not be saved.'));
    }
  }

  async function submitQuota(values: SaveAgentQuotaInput) {
    try {
      await saveQuota.mutateAsync(values);
      toast.success(editingQuota ? 'Quota updated' : 'Quota added');
      setQuotaSaveError(null);
      setQuotaAccount(null);
      setEditingQuota(null);
    } catch (error) {
      setQuotaSaveError({
        field:
          error instanceof TauriCommandError &&
          error.code === 'AGENT_USAGE_CONFLICT'
            ? 'label'
            : 'form',
        message: safeError(error, 'The quota window could not be saved.'),
      });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'account') {
      deleteAccount.mutate(deleteTarget.account.id, {
        onError: (error) =>
          toast.danger(safeError(error, 'The account could not be deleted.')),
        onSuccess: () => toast.success('Account deleted'),
      });
    } else {
      deleteQuota.mutate(
        {
          accountId: deleteTarget.account.id,
          quotaId: deleteTarget.quota.id,
        },
        {
          onError: (error) =>
            toast.danger(safeError(error, 'The quota could not be removed.')),
          onSuccess: () => toast.success('Quota removed'),
        },
      );
    }
    setDeleteTarget(null);
  }

  function openNewAccount(selection: InitialPlatform | null = null) {
    setEditingAccount(null);
    setInitialPlatform(selection);
    setIsAccountOpen(true);
  }

  function openQuota(account: AgentAccount, quota: AgentQuota | null) {
    setQuotaSaveError(null);
    setEditingQuota(quota);
    setQuotaAccount(account);
  }

  function clearFilters() {
    setSearch('');
    setPlatform('all');
    setStatus('all');
  }

  return (
    <section
      aria-labelledby="agent-usage-title"
      className="mx-auto w-full max-w-7xl space-y-4"
    >
      <header className="flex flex-col gap-3 pb-3 border-b border-divider sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <IconRobot
              aria-hidden="true"
              className="text-accent"
              size={22}
              stroke={ICON_STROKE}
            />
            <h1
              className="font-mono text-2xl font-semibold tracking-tight text-foreground"
              id="agent-usage-title"
            >
              Agent Usage
            </h1>
          </div>
          <p className="font-mono mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Track quota availability across your AI agent accounts. All usage
            snapshots stay on this device.
          </p>
        </div>
        <Button onPress={() => openNewAccount()} size="sm" variant="primary">
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Add account
        </Button>
      </header>

      <AgentUsageSummary accounts={accountItems} />
      <AgentUsageToolbar
        onClear={clearFilters}
        onPlatformChange={setPlatform}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onStatusChange={setStatus}
        platform={platform}
        search={search}
        sort={sort}
        status={status}
      />

      {accounts.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-44 rounded-md" key={index} />
          ))}
        </div>
      ) : accounts.isError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Agent Usage is unavailable</Alert.Title>
            <Alert.Description>
              Local Agent Usage data could not be loaded. Try again after
              checking the application database.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : platformGroups.length === 0 ? (
        <AgentUsageEmptyState
          hasAccounts={accountItems.length > 0}
          onAdd={() => openNewAccount()}
          onClear={clearFilters}
        />
      ) : (
        <div
          className="space-y-3"
          data-highlighted-quota={highlightedQuotaId ?? undefined}
        >
          {platformGroups.map((group, index) => (
            <AgentPlatformGroup
              group={group}
              isExpanded={platformExpansion[group.id] ?? index === 0}
              key={group.id}
              onAddAccount={() =>
                openNewAccount({
                  customPlatform: group.customPlatform,
                  platform: group.platform,
                })
              }
              onAddQuota={(account) => openQuota(account, null)}
              onDeleteAccount={(account) =>
                setDeleteTarget({ account, kind: 'account' })
              }
              onDeleteQuota={(account, quota) =>
                setDeleteTarget({ account, kind: 'quota', quota })
              }
              onEditAccount={(account) => {
                setEditingAccount(account);
                setInitialPlatform(null);
                setIsAccountOpen(true);
              }}
              onEditQuota={(account, quota) => openQuota(account, quota)}
              onExpandedChange={(isExpanded) =>
                setPlatformExpansion((current) => ({
                  ...current,
                  [group.id]: isExpanded,
                }))
              }
            />
          ))}
        </div>
      )}

      <AgentAccountDialog
        account={editingAccount}
        initialPlatform={initialPlatform}
        isOpen={isAccountOpen}
        isSaving={saveAccount.isPending}
        onOpenChange={(isOpen) => {
          setIsAccountOpen(isOpen);
          if (!isOpen) {
            setEditingAccount(null);
            setInitialPlatform(null);
          }
        }}
        onSubmit={submitAccount}
      />
      {quotaAccount && (
        <AgentQuotaDialog
          account={quotaAccount}
          isOpen
          isSaving={saveQuota.isPending}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setQuotaSaveError(null);
              setQuotaAccount(null);
              setEditingQuota(null);
            }
          }}
          onSaveErrorClear={() => setQuotaSaveError(null)}
          onSubmit={submitQuota}
          quota={editingQuota}
          saveError={quotaSaveError}
        />
      )}
      <ConfirmDialog
        body={
          deleteTarget?.kind === 'account'
            ? `Delete ${deleteTarget.account.identifier} and all of its quota windows?`
            : deleteTarget
              ? `Remove the ${deleteTarget.quota.label} quota window?`
              : null
        }
        isOpen={Boolean(deleteTarget)}
        onConfirm={confirmDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === 'account' ? 'Delete account' : 'Remove quota'
        }
      />
    </section>
  );
}

function AgentUsageEmptyState({
  hasAccounts,
  onAdd,
  onClear,
}: {
  hasAccounts: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="border border-dashed border-divider bg-surface">
      <Card.Content className="py-12">
        <EmptyState className="text-center">
          <IconRobot
            aria-hidden="true"
            className="mx-auto text-muted"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <h2 className="mt-3 font-semibold">
            {hasAccounts
              ? 'No accounts match the current filters'
              : 'No agent accounts yet'}
          </h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
            {hasAccounts
              ? 'Clear the filters to see every locally tracked account.'
              : 'Track AI agent usage by adding your first account and quota window.'}
          </p>
          <Button
            aria-label={hasAccounts ? undefined : 'Add first account'}
            className="mx-auto mt-4"
            onPress={hasAccounts ? onClear : onAdd}
            size="sm"
            variant={hasAccounts ? 'secondary' : 'primary'}
          >
            {hasAccounts ? 'Clear filters' : 'Add account'}
          </Button>
        </EmptyState>
      </Card.Content>
    </Card>
  );
}

function safeError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
