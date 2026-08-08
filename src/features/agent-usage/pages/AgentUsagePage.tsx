import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconClock,
  IconEdit,
  IconGauge,
  IconPlus,
  IconRobot,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ConfirmDialog } from '@/shared/ui';
import { AgentAccountDialog } from '../components/AgentAccountDialog';
import { AgentQuotaDialog } from '../components/AgentQuotaDialog';
import {
  useAgentAccountsQuery,
  useDeleteAgentAccountMutation,
  useDeleteAgentQuotaMutation,
  useSaveAgentAccountMutation,
  useSaveAgentQuotaMutation,
} from '../hooks/use-agent-usage';
import {
  PLATFORM_LABELS,
  SIGN_IN_METHOD_LABELS,
  type AgentAccount,
  type AgentAccountFormValues,
  type AgentAvailability,
  type AgentPlatform,
  type AgentQuota,
  type SaveAgentQuotaInput,
} from '../models/agent-usage';

type StatusFilter = AgentAvailability | 'all';
type PlatformFilter = AgentPlatform | 'all';
type SortOption = 'availability' | 'next_reset' | 'platform';
type DeleteTarget =
  | { account: AgentAccount; kind: 'account' }
  | { account: AgentAccount; kind: 'quota'; quota: AgentQuota };

const STATUS_ORDER: Record<AgentAvailability, number> = {
  exhausted: 0,
  limited: 1,
  resetSoon: 2,
  unknown: 3,
  available: 4,
};

export function AgentUsagePage() {
  const accounts = useAgentAccountsQuery();
  const saveAccount = useSaveAgentAccountMutation();
  const deleteAccount = useDeleteAgentAccountMutation();
  const saveQuota = useSaveAgentQuotaMutation();
  const deleteQuota = useDeleteAgentQuotaMutation();
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('availability');
  const [editingAccount, setEditingAccount] = useState<AgentAccount | null>(
    null,
  );
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [quotaAccount, setQuotaAccount] = useState<AgentAccount | null>(null);
  const [editingQuota, setEditingQuota] = useState<AgentQuota | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const visibleAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return [...(accounts.data ?? [])]
      .filter((account) => platform === 'all' || account.platform === platform)
      .filter((account) => status === 'all' || account.availability === status)
      .filter((account) => {
        if (!normalizedSearch) return true;
        return [
          account.identifier,
          platformName(account),
          SIGN_IN_METHOD_LABELS[account.signInMethod],
        ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
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
  }, [accounts.data, platform, search, sort, status]);

  async function submitAccount(values: AgentAccountFormValues) {
    try {
      await saveAccount.mutateAsync({
        ...values,
        ...(editingAccount ? { id: editingAccount.id } : {}),
      });
      toast.success(editingAccount ? 'Account updated' : 'Account added');
      setIsAccountOpen(false);
      setEditingAccount(null);
    } catch (error) {
      toast.danger(safeError(error, 'The account could not be saved.'));
    }
  }

  async function submitQuota(values: SaveAgentQuotaInput) {
    try {
      await saveQuota.mutateAsync(values);
      toast.success(editingQuota ? 'Quota updated' : 'Quota added');
      setQuotaAccount(null);
      setEditingQuota(null);
    } catch (error) {
      toast.danger(safeError(error, 'The quota window could not be saved.'));
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

  const accountItems = accounts.data ?? [];
  const availableCount = accountItems.filter(
    (account) => account.availability === 'available',
  ).length;
  const constrainedCount = accountItems.filter((account) =>
    ['limited', 'exhausted'].includes(account.availability),
  ).length;
  const nextReset = accountItems
    .map((account) => account.nextResetAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];

  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-5"
      aria-labelledby="agent-usage-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            <IconGauge
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            Global workspace
          </div>
          <h1
            id="agent-usage-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Agent Usage
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            See which coding-agent account is usable now, what is constrained,
            and which quota resets next. Data stays on this device and does not
            depend on the active project.
          </p>
        </div>
        <Button
          onPress={() => {
            setEditingAccount(null);
            setIsAccountOpen(true);
          }}
          size="sm"
          variant="primary"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Add account
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Available now" value={availableCount} />
        <MetricCard label="Limited / exhausted" value={constrainedCount} />
        <MetricCard
          label="Next known reset"
          value={nextReset ? formatReset(nextReset) : 'Not scheduled'}
        />
      </div>

      <Card className="border border-divider bg-surface">
        <Card.Content className="grid gap-3 p-3 md:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,auto))]">
          <TextField fullWidth variant="secondary">
            <Label className="sr-only">Search account identifier</Label>
            <Input
              aria-label="Search account identifier"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account identifier..."
              value={search}
            />
          </TextField>
          <FilterSelect
            label="Platform"
            onChange={(value) => setPlatform(value as PlatformFilter)}
            options={[
              ['all', 'All platforms'],
              ...Object.entries(PLATFORM_LABELS),
            ]}
            value={platform}
          />
          <FilterSelect
            label="Availability"
            onChange={(value) => setStatus(value as StatusFilter)}
            options={[
              ['all', 'All statuses'],
              ['available', 'Available'],
              ['limited', 'Limited'],
              ['exhausted', 'Exhausted'],
              ['resetSoon', 'Reset soon'],
              ['unknown', 'Unknown'],
            ]}
            value={status}
          />
          <FilterSelect
            label="Sort"
            onChange={(value) => setSort(value as SortOption)}
            options={[
              ['availability', 'Availability'],
              ['next_reset', 'Next reset'],
              ['platform', 'Platform'],
            ]}
            value={sort}
          />
        </Card.Content>
      </Card>

      {accounts.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-64 rounded-md" key={index} />
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
      ) : visibleAccounts.length === 0 ? (
        <Card className="border border-dashed border-divider bg-surface">
          <Card.Content className="py-14">
            <EmptyState className="text-center">
              <IconRobot
                aria-hidden="true"
                className="mx-auto text-muted"
                size={ICON_SIZE.emptyState}
                stroke={ICON_STROKE}
              />
              <h2 className="mt-3 font-semibold">
                {accountItems.length === 0
                  ? 'No coding-agent accounts yet'
                  : 'No accounts match these filters'}
              </h2>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
                {accountItems.length === 0
                  ? 'Add an account and record one or more reset windows. Manual tracking works offline and on free plans.'
                  : 'Broaden the platform, availability, or search filters.'}
              </p>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {visibleAccounts.map((account) => (
            <AccountCard
              account={account}
              key={account.id}
              onAddQuota={() => {
                setEditingQuota(null);
                setQuotaAccount(account);
              }}
              onDelete={() => setDeleteTarget({ account, kind: 'account' })}
              onDeleteQuota={(quota) =>
                setDeleteTarget({ account, kind: 'quota', quota })
              }
              onEdit={() => {
                setEditingAccount(account);
                setIsAccountOpen(true);
              }}
              onEditQuota={(quota) => {
                setEditingQuota(quota);
                setQuotaAccount(account);
              }}
            />
          ))}
        </div>
      )}

      <AgentAccountDialog
        account={editingAccount}
        isOpen={isAccountOpen}
        isSaving={saveAccount.isPending}
        onOpenChange={(isOpen) => {
          setIsAccountOpen(isOpen);
          if (!isOpen) setEditingAccount(null);
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
              setQuotaAccount(null);
              setEditingQuota(null);
            }
          }}
          onSubmit={submitQuota}
          quota={editingQuota}
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

function AccountCard({
  account,
  onAddQuota,
  onDelete,
  onDeleteQuota,
  onEdit,
  onEditQuota,
}: {
  account: AgentAccount;
  onAddQuota: () => void;
  onDelete: () => void;
  onDeleteQuota: (quota: AgentQuota) => void;
  onEdit: () => void;
  onEditQuota: (quota: AgentQuota) => void;
}) {
  return (
    <Card className="overflow-hidden border border-divider bg-surface">
      <Card.Header className="flex flex-row items-start justify-between gap-3 border-b border-divider px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-base">
              {platformName(account)}
            </Card.Title>
            <StatusChip status={account.availability} />
          </div>
          <p className="mt-1 break-all font-mono text-sm text-foreground">
            {account.identifier}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            {SIGN_IN_METHOD_LABELS[account.signInMethod]} · Manual ·{' '}
            {account.defaultTimezone}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            aria-label={`Edit account ${account.identifier}`}
            isIconOnly
            onPress={onEdit}
            size="sm"
            variant="ghost"
          >
            <IconEdit
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
          <Button
            aria-label={`Delete account ${account.identifier}`}
            isIconOnly
            onPress={onDelete}
            size="sm"
            variant="ghost"
          >
            <IconTrash
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
        </div>
      </Card.Header>
      <Card.Content className="space-y-3 p-4">
        {account.quotas.length === 0 ? (
          <div className="rounded border border-dashed border-divider bg-workspace p-4 text-sm text-muted">
            No quota windows yet. Add the daily, weekly, monthly, credit, or
            custom reset shown by this provider.
          </div>
        ) : (
          <div className="space-y-2">
            {account.quotas.map((quota) => (
              <div
                className="rounded border border-divider bg-workspace p-3"
                key={quota.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{quota.label}</p>
                      <StatusChip status={quota.status} />
                    </div>
                    <p className="mt-1 text-sm text-secondary">
                      {quota.remainingPercent == null || quota.usageIsStale
                        ? quota.resetReachedAt
                          ? 'Usage not updated after reset'
                          : 'Usage remaining unknown'
                        : `${quota.remainingPercent}% remaining`}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted">
                      <IconClock aria-hidden="true" size={12} />
                      {quota.resetReachedAt
                        ? `Reset reached ${relativeReset(quota.resetAt)}`
                        : `${resetTimingLabel(quota)} · ${relativeReset(quota.resetAt)}`}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                      Source:{' '}
                      {quota.trackingSource === 'pasted'
                        ? 'Pasted message'
                        : 'Manual'}
                      {quota.usageUpdatedAt
                        ? ` · Snapshot ${relativeReset(quota.usageUpdatedAt)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label={`Edit ${quota.label} quota for ${account.identifier}`}
                      isIconOnly
                      onPress={() => onEditQuota(quota)}
                      size="sm"
                      variant="ghost"
                    >
                      <IconEdit
                        aria-hidden="true"
                        size={ICON_SIZE.small}
                        stroke={ICON_STROKE}
                      />
                    </Button>
                    <Button
                      aria-label={`Remove ${quota.label} quota for ${account.identifier}`}
                      isIconOnly
                      onPress={() => onDeleteQuota(quota)}
                      size="sm"
                      variant="ghost"
                    >
                      <IconTrash
                        aria-hidden="true"
                        size={ICON_SIZE.small}
                        stroke={ICON_STROKE}
                      />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          aria-label={`Add quota for ${account.identifier}`}
          className="w-full"
          onPress={onAddQuota}
          size="sm"
          variant="secondary"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Add quota window
        </Button>
      </Card.Content>
    </Card>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card className="border border-divider bg-surface">
      <Card.Content className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {label}
        </p>
        <p
          className="mt-1 truncate text-lg font-semibold"
          title={String(value)}
        >
          {value}
        </p>
      </Card.Content>
    </Card>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: [string, string][];
  value: string;
}) {
  return (
    <Select
      aria-label={label}
      onChange={(next) => onChange(String(next))}
      value={value}
      variant="secondary"
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(([option, optionLabel]) => (
            <ListBox.Item id={option} key={option} textValue={optionLabel}>
              <Label>{optionLabel}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function StatusChip({ status }: { status: AgentAvailability }) {
  const presentation = {
    available: { color: 'success' as const, label: 'Available' },
    exhausted: { color: 'danger' as const, label: 'Exhausted' },
    limited: { color: 'warning' as const, label: 'Limited' },
    resetSoon: { color: 'accent' as const, label: 'Reset soon' },
    unknown: { color: 'default' as const, label: 'Unknown' },
  }[status];
  return (
    <Chip color={presentation.color} size="sm" variant="soft">
      <Chip.Label className="font-mono text-[10px] uppercase tracking-wide">
        {presentation.label}
      </Chip.Label>
    </Chip>
  );
}

function resetTimingLabel(quota: AgentQuota): string {
  if (quota.resetTiming === 'today' || quota.resetTiming === 'tomorrow') {
    return `Resets ${quota.resetTiming} at ${new Intl.DateTimeFormat(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: quota.timezone,
      },
    ).format(new Date(quota.resetAt))}`;
  }
  return `Resets ${formatReset(quota.resetAt)}`;
}

function platformName(account: AgentAccount): string {
  return account.customPlatform ?? PLATFORM_LABELS[account.platform];
}

function resetSort(value: string | null): number {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatReset(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function relativeReset(value: string): string {
  const difference = new Date(value).getTime() - Date.now();
  const absoluteMinutes = Math.round(Math.abs(difference) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absoluteMinutes < 60) {
    return formatter.format(Math.sign(difference) * absoluteMinutes, 'minute');
  }
  const hours = Math.round(absoluteMinutes / 60);
  if (hours < 48)
    return formatter.format(Math.sign(difference) * hours, 'hour');
  const days = Math.round(hours / 24);
  return formatter.format(Math.sign(difference) * days, 'day');
}

function safeError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
