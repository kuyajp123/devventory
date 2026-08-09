import {
  Button,
  Card,
  Disclosure,
  Dropdown,
  Label,
  Table,
} from '@heroui/react';
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { AgentAccount, AgentQuota } from '../models/agent-usage';
import {
  accountQuotaSummary,
  countAgentStatuses,
  type AgentPlatformGroup as AgentPlatformGroupModel,
} from '../models/agent-usage-view';
import { AgentAvailabilityBadge } from './AgentAvailabilityBadge';
import { AgentQuotaWindowList } from './AgentQuotaWindowList';

interface AgentPlatformGroupProps {
  group: AgentPlatformGroupModel;
  isExpanded: boolean;
  onAddAccount: () => void;
  onAddQuota: (account: AgentAccount) => void;
  onDeleteAccount: (account: AgentAccount) => void;
  onDeleteQuota: (account: AgentAccount, quota: AgentQuota) => void;
  onEditAccount: (account: AgentAccount) => void;
  onEditQuota: (account: AgentAccount, quota: AgentQuota) => void;
  onExpandedChange: (isExpanded: boolean) => void;
}

type AccountTableRow =
  | { account: AgentAccount; id: string; kind: 'account' }
  | { account: AgentAccount; id: string; kind: 'details' };

export function AgentPlatformGroup({
  group,
  isExpanded,
  onAddAccount,
  onAddQuota,
  onDeleteAccount,
  onDeleteQuota,
  onEditAccount,
  onEditQuota,
  onExpandedChange,
}: AgentPlatformGroupProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    () => new Set(),
  );
  const rows = useMemo(
    () =>
      group.accounts.flatMap<AccountTableRow>((account) => [
        { account, id: account.id, kind: 'account' },
        ...(expandedAccounts.has(account.id)
          ? ([
              {
                account,
                id: `${account.id}:details`,
                kind: 'details',
              },
            ] satisfies AccountTableRow[])
          : []),
      ]),
    [expandedAccounts, group.accounts],
  );

  function toggleAccount(id: string) {
    setExpandedAccounts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card
      aria-label={`${group.label} platform accounts`}
      className="overflow-hidden border border-divider bg-surface rounded-[4px] shadow-none"
      role="region"
    >
      <Disclosure isExpanded={isExpanded} onExpandedChange={onExpandedChange}>
        <div className="flex items-center gap-3 border-b border-divider px-3 py-2.5">
          <Disclosure.Heading className="min-w-0 flex-1" aria-level={2}>
            <Disclosure.Trigger
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label} platform accounts`}
              className="group flex w-full min-w-0 items-center gap-3 rounded px-1 py-1 text-left hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <IconChevronDown
                aria-hidden="true"
                className="-rotate-90 shrink-0 text-muted transition-transform group-data-[expanded=true]:rotate-0 motion-reduce:transition-none"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {group.label}
                </span>
                <span className="block text-xs text-muted">
                  {group.accounts.length}{' '}
                  {group.accounts.length === 1 ? 'account' : 'accounts'}
                </span>
              </span>
              <PlatformStatusSummary accounts={group.accounts} />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Button
            aria-label={`Add account to ${group.label}`}
            onPress={onAddAccount}
            size="sm"
            variant="ghost"
          >
            <IconPlus
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            Add account
          </Button>
        </div>

        <Disclosure.Content>
          <Disclosure.Body className="p-0">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label={`${group.label} agent accounts`}>
                  <Table.Header>
                    <Table.Column id="account" isRowHeader>
                      Account
                    </Table.Column>
                    <Table.Column id="quota">Quota</Table.Column>
                    <Table.Column className="hidden lg:table-cell" id="reset">
                      Next reset
                    </Table.Column>
                    <Table.Column id="status">Status</Table.Column>
                    <Table.Column className="hidden xl:table-cell" id="updated">
                      Updated
                    </Table.Column>
                    <Table.Column id="actions">Actions</Table.Column>
                  </Table.Header>
                  <Table.Body items={rows}>
                    {(row) =>
                      row.kind === 'details' ? (
                        <Table.Row
                          className="bg-workspace"
                          id={row.id}
                          textValue={`${row.account.identifier} quota details`}
                        >
                          <Table.Cell className="p-0" colSpan={6}>
                            <AgentQuotaWindowList
                              account={row.account}
                              onAdd={() => onAddQuota(row.account)}
                              onDelete={(quota) =>
                                onDeleteQuota(row.account, quota)
                              }
                              onEdit={(quota) =>
                                onEditQuota(row.account, quota)
                              }
                            />
                          </Table.Cell>
                        </Table.Row>
                      ) : (
                        <AccountRow
                          account={row.account}
                          isExpanded={expandedAccounts.has(row.account.id)}
                          onAddQuota={() => onAddQuota(row.account)}
                          onDelete={() => onDeleteAccount(row.account)}
                          onEdit={() => onEditAccount(row.account)}
                          onToggle={() => toggleAccount(row.account.id)}
                        />
                      )
                    }
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

function AccountRow({
  account,
  isExpanded,
  onAddQuota,
  onDelete,
  onEdit,
  onToggle,
}: {
  account: AgentAccount;
  isExpanded: boolean;
  onAddQuota: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const quota = accountQuotaSummary(account);
  return (
    <Table.Row id={account.id} textValue={account.identifier}>
      <Table.Cell>
        <Button
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} account ${account.identifier}`}
          className="min-w-0 max-w-full justify-start px-0 font-normal"
          onPress={onToggle}
          size="sm"
          variant="ghost"
        >
          <IconChevronRight
            aria-hidden="true"
            className={`shrink-0 transition-transform motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          <span
            className="truncate font-mono text-xs"
            title={account.identifier}
          >
            {account.identifier}
          </span>
        </Button>
      </Table.Cell>
      <Table.Cell>
        <p className="whitespace-nowrap text-xs font-medium">{quota.label}</p>
        <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted">
          {quota.detail}
        </p>
      </Table.Cell>
      <Table.Cell className="hidden whitespace-nowrap text-xs lg:table-cell">
        {account.nextResetAt
          ? formatTimestamp(account.nextResetAt)
          : 'Not scheduled'}
      </Table.Cell>
      <Table.Cell>
        <AgentAvailabilityBadge status={account.availability} />
      </Table.Cell>
      <Table.Cell className="hidden whitespace-nowrap text-xs text-muted xl:table-cell">
        {relativeTime(account.updatedAt)}
      </Table.Cell>
      <Table.Cell>
        <AccountActions
          account={account}
          onAddQuota={onAddQuota}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </Table.Cell>
    </Table.Row>
  );
}

function AccountActions({
  account,
  onAddQuota,
  onDelete,
  onEdit,
}: {
  account: AgentAccount;
  onAddQuota: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  function handleAction(action: React.Key) {
    if (action === 'edit') onEdit();
    if (action === 'add-quota') onAddQuota();
    if (action === 'delete') onDelete();
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`Open actions for ${account.identifier}`}
        className="inline-flex size-8 items-center justify-center rounded text-muted transition hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <IconDotsVertical
          aria-hidden="true"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="edit" textValue="Edit account">
            <IconEdit
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <Label>Edit account</Label>
          </Dropdown.Item>
          <Dropdown.Item id="add-quota" textValue="Add quota window">
            <IconPlus
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <Label>Add quota window</Label>
          </Dropdown.Item>
          <Dropdown.Item
            id="delete"
            textValue="Delete account"
            variant="danger"
          >
            <IconTrash
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <Label>Delete account</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function PlatformStatusSummary({ accounts }: { accounts: AgentAccount[] }) {
  const counts = countAgentStatuses(accounts);
  const items = [
    { className: 'bg-success', count: counts.available, label: 'available' },
    { className: 'bg-warning', count: counts.limited, label: 'limited' },
    { className: 'bg-danger', count: counts.exhausted, label: 'exhausted' },
    { className: 'bg-accent', count: counts.resetSoon, label: 'reset soon' },
    { className: 'bg-muted', count: counts.unknown, label: 'unknown' },
  ].filter((item) => item.count > 0);
  return (
    <span className="ml-auto hidden flex-wrap justify-end gap-x-3 gap-y-1 pr-2 text-[11px] text-muted md:flex">
      {items.map((item) => (
        <span className="inline-flex items-center gap-1.5" key={item.label}>
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${item.className}`}
          />
          {item.count} {item.label}
        </span>
      ))}
    </span>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function relativeTime(value: string): string {
  const difference = new Date(value).getTime() - Date.now();
  const days = Math.round(Math.abs(difference) / 86_400_000);
  if (days > 7) return formatTimestamp(value);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (days > 0) return formatter.format(Math.sign(difference) * days, 'day');
  const hours = Math.round(Math.abs(difference) / 3_600_000);
  return formatter.format(Math.sign(difference) * hours, 'hour');
}
