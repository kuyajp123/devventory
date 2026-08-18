import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconCircleCheck,
  IconExternalLink,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { Spinner } from '@heroui/react';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agentUsageGateway } from '@/features/agent-usage/services/agent-usage.gateway';
import {
  PLATFORM_LABELS,
  type AgentAccount,
  type AgentQuota,
} from '@/features/agent-usage/models/agent-usage';
import {
  buildExactResetAt,
  buildRelativeResetAt,
  computeExactFromRelative,
  computeRelativeFromExact,
  computeRelativeFromResetAt,
  formatResetSummary,
  parseExistingResetAt,
  parseTextDate,
  parseTextTime,
} from '@/features/agent-usage/components/reset-at';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { openAgentUsageFromQuickAccess } from './services/quick-access.gateway';

interface QuotaWindowFlowProps {
  onClose: () => void;
}

const DEFAULT_RESET_HOURS = 1;

type FlowMode = 'new' | 'edit';
type ResetMode = 'exact' | 'relative';

export function QuotaWindowFlow({ onClose }: QuotaWindowFlowProps) {
  const [flowMode, setFlowMode] = useState<FlowMode>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);

  // Form inputs
  const [label, setLabel] = useState('');
  const [remaining, setRemaining] = useState('');
  const [remindResetReached, setRemindResetReached] = useState(true);

  // Reset timing state (New mode)
  const [hasResetTime, setHasResetTime] = useState(false);

  // Reset timing state (Edit mode)
  const [isEditingReset, setIsEditingReset] = useState(false);

  // Shared reset input mode
  const [resetMode, setResetMode] = useState<ResetMode>('exact');
  const [exactDate, setExactDate] = useState('');
  const [exactTime, setExactTime] = useState('');
  const [days, setDays] = useState('0');
  const [hours, setHours] = useState(String(DEFAULT_RESET_HOURS));
  const [minutes, setMinutes] = useState('0');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQuota, setSavedQuota] = useState<AgentQuota | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Listen for navigation events from Tauri
  useEffect(() => {
    let isDisposed = false;
    const unlistenPromise = listen('agent-usage://navigate', () => {
      if (!isDisposed) {
        onClose(); // Return to home when navigation happens
      }
    });

    return () => {
      isDisposed = true;
      void unlistenPromise
        .then((unlisten) => unlisten())
        .catch(() => undefined);
    };
  }, [onClose]);

  // Derive unique platforms from accounts
  const platforms = useMemo(
    () => Array.from(new Set(accounts.map((acc) => acc.platform))).sort(),
    [accounts],
  );

  // Filter accounts by selected platform
  const platformAccounts = useMemo(
    () =>
      selectedPlatform
        ? accounts.filter((acc) => acc.platform === selectedPlatform)
        : [],
    [accounts, selectedPlatform],
  );

  const selectedAccount = useMemo(
    () => accounts.find((acc) => acc.id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  // Filter quota windows by selected account
  const accountQuotas = useMemo(
    () => (selectedAccount ? selectedAccount.quotas : []),
    [selectedAccount],
  );

  const selectedQuota = useMemo(
    () => accountQuotas.find((q) => q.id === selectedQuotaId),
    [accountQuotas, selectedQuotaId],
  );

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedAccounts = await agentUsageGateway.listAccounts();
      setAccounts(loadedAccounts);
    } catch (err) {
      setError(commandError(err, 'Agent Usage accounts could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, [loadAccounts]);

  // Auto-select first platform if only one exists
  useEffect(() => {
    if (platforms.length === 1 && !selectedPlatform) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPlatform(platforms[0]);
    }
  }, [platforms, selectedPlatform]);

  // Auto-select first account if only one in selected platform
  useEffect(() => {
    if (
      selectedPlatform &&
      platformAccounts.length === 1 &&
      !selectedAccountId
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAccountId(platformAccounts[0].id);
    }
  }, [selectedPlatform, platformAccounts, selectedAccountId]);

  // Clear account selection if platform changes and current account no longer belongs
  useEffect(() => {
    if (selectedAccountId && selectedPlatform) {
      const account = accounts.find((acc) => acc.id === selectedAccountId);
      if (account && account.platform !== selectedPlatform) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedAccountId(null);
        setSelectedQuotaId(null);
      }
    }
  }, [selectedPlatform, selectedAccountId, accounts]);

  // Focus label input when form is ready
  useEffect(() => {
    if (
      !isLoading &&
      selectedAccountId &&
      (flowMode === 'new' || selectedQuotaId) &&
      labelInputRef.current
    ) {
      labelInputRef.current.focus();
    }
  }, [isLoading, selectedAccountId, selectedQuotaId, flowMode]);

  const handleSelectPlatform = useCallback((platform: string) => {
    setSelectedPlatform(platform);
    setSelectedQuotaId(null);
    setError(null);
  }, []);

  const handleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedQuotaId(null);
    setError(null);
  }, []);

  const resetFormFields = useCallback(() => {
    setLabel('');
    setRemaining('');
    setRemindResetReached(true);
    setHasResetTime(false);
    setIsEditingReset(false);
    setResetMode('exact');
    setExactDate('');
    setExactTime('');
    setDays('0');
    setHours(String(DEFAULT_RESET_HOURS));
    setMinutes('0');
    setError(null);
    setSavedQuota(null);
  }, []);

  const handleSwitchFlowMode = useCallback(
    (mode: FlowMode) => {
      setFlowMode(mode);
      setSelectedQuotaId(null);
      resetFormFields();
      if (mode === 'edit') {
        void loadAccounts();
      }
    },
    [resetFormFields, loadAccounts],
  );

  const activeTimezone = useMemo(
    () => selectedQuota?.timezone ?? selectedAccount?.defaultTimezone ?? 'UTC',
    [selectedQuota?.timezone, selectedAccount?.defaultTimezone],
  );

  const handleSelectQuota = useCallback(
    (quotaId: string) => {
      setSelectedQuotaId(quotaId);
      setError(null);
      const quota = accountQuotas.find((q) => q.id === quotaId);
      if (quota) {
        setLabel(quota.label);
        setRemaining(
          quota.remainingPercent != null ? String(quota.remainingPercent) : '',
        );
        setRemindResetReached(quota.reminders.resetReached);
        setIsEditingReset(false);

        // Prefill exact date and time derived from existing resetAt in quota timezone
        const exact = parseExistingResetAt(quota.resetAt, quota.timezone);
        setExactDate(exact.calDate.toString());
        setExactTime(exact.time);
        setResetMode('exact');

        // Automatically compute relative duration from existing resetAt
        const rel = computeRelativeFromResetAt(quota.resetAt);
        setDays(rel.days);
        setHours(rel.hours);
        setMinutes(rel.minutes);
      }
    },
    [accountQuotas],
  );

  const handleSetResetTime = useCallback(() => {
    setHasResetTime(true);
    setResetMode('exact');
    setDays('0');
    setHours(String(DEFAULT_RESET_HOURS));
    setMinutes('0');
    const exact = computeExactFromRelative(
      0,
      DEFAULT_RESET_HOURS,
      0,
      activeTimezone,
    );
    if (exact) {
      setExactDate(exact.exactDate);
      setExactTime(exact.exactTime);
    }
    setError(null);
  }, [activeTimezone]);

  const handleRemoveResetTime = useCallback(() => {
    setHasResetTime(false);
    setResetMode('exact');
    setExactDate('');
    setExactTime('');
    setDays('0');
    setHours(String(DEFAULT_RESET_HOURS));
    setMinutes('0');
    setError(null);
  }, []);

  const handleStartEditReset = useCallback(() => {
    if (selectedQuota) {
      const exact = parseExistingResetAt(
        selectedQuota.resetAt,
        selectedQuota.timezone,
      );
      setExactDate(exact.calDate.toString());
      setExactTime(exact.time);
      const rel = computeRelativeFromResetAt(selectedQuota.resetAt);
      setDays(rel.days);
      setHours(rel.hours);
      setMinutes(rel.minutes);
    }
    setIsEditingReset(true);
  }, [selectedQuota]);

  const handleCancelResetChange = useCallback(() => {
    setIsEditingReset(false);
    if (selectedQuota) {
      const exact = parseExistingResetAt(
        selectedQuota.resetAt,
        selectedQuota.timezone,
      );
      setExactDate(exact.calDate.toString());
      setExactTime(exact.time);
      const rel = computeRelativeFromResetAt(selectedQuota.resetAt);
      setDays(rel.days);
      setHours(rel.hours);
      setMinutes(rel.minutes);
    } else {
      setExactDate('');
      setExactTime('');
      setDays('0');
      setHours(String(DEFAULT_RESET_HOURS));
      setMinutes('0');
    }
    setResetMode('exact');
    setError(null);
  }, [selectedQuota]);

  const handleModeChange = useCallback(
    (newMode: ResetMode) => {
      if (newMode === 'relative') {
        const calDate = parseTextDate(exactDate);
        if (calDate && exactTime) {
          const rel = computeRelativeFromExact(
            calDate,
            exactTime,
            activeTimezone,
          );
          if (rel) {
            setDays(rel.days);
            setHours(rel.hours);
            setMinutes(rel.minutes);
          }
        }
      } else if (newMode === 'exact') {
        const exact = computeExactFromRelative(
          days,
          hours,
          minutes,
          activeTimezone,
        );
        if (exact) {
          setExactDate(exact.exactDate);
          setExactTime(exact.exactTime);
        }
      }
      setResetMode(newMode);
    },
    [exactDate, exactTime, days, hours, minutes, activeTimezone],
  );

  const handleExactDateChange = useCallback(
    (val: string) => {
      setExactDate(val);
      const calDate = parseTextDate(val);
      if (calDate && exactTime) {
        const rel = computeRelativeFromExact(
          calDate,
          exactTime,
          activeTimezone,
        );
        if (rel) {
          setDays(rel.days);
          setHours(rel.hours);
          setMinutes(rel.minutes);
        }
      }
    },
    [exactTime, activeTimezone],
  );

  const handleExactTimeChange = useCallback(
    (val: string) => {
      setExactTime(val);
      const calDate = parseTextDate(exactDate);
      if (calDate && val) {
        const rel = computeRelativeFromExact(calDate, val, activeTimezone);
        if (rel) {
          setDays(rel.days);
          setHours(rel.hours);
          setMinutes(rel.minutes);
        }
      }
    },
    [exactDate, activeTimezone],
  );

  const handleDaysChange = useCallback(
    (val: string) => {
      setDays(val);
      const exact = computeExactFromRelative(
        val,
        hours,
        minutes,
        activeTimezone,
      );
      if (exact) {
        setExactDate(exact.exactDate);
        setExactTime(exact.exactTime);
      }
    },
    [hours, minutes, activeTimezone],
  );

  const handleHoursChange = useCallback(
    (val: string) => {
      setHours(val);
      const exact = computeExactFromRelative(
        days,
        val,
        minutes,
        activeTimezone,
      );
      if (exact) {
        setExactDate(exact.exactDate);
        setExactTime(exact.exactTime);
      }
    },
    [days, minutes, activeTimezone],
  );

  const handleMinutesChange = useCallback(
    (val: string) => {
      setMinutes(val);
      const exact = computeExactFromRelative(days, hours, val, activeTimezone);
      if (exact) {
        setExactDate(exact.exactDate);
        setExactTime(exact.exactTime);
      }
    },
    [days, hours, activeTimezone],
  );

  const handleSave = useCallback(async () => {
    if (flowMode === 'new') {
      if (!selectedAccountId || !label.trim()) {
        setError('Select an account and enter a quota label.');
        return;
      }
    } else {
      if (!selectedAccountId || !selectedQuotaId || !selectedQuota) {
        setError('Select an account and an existing quota window to edit.');
        return;
      }
      if (!label.trim()) {
        setError('Enter a quota label.');
        return;
      }
    }

    const account = accounts.find((acc) => acc.id === selectedAccountId);
    if (!account) return;

    // Validate remaining percentage
    let remainingPercent: number | null = null;
    if (remaining.trim()) {
      const num = Number(remaining.trim());
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        setError('Enter a percentage from 0 to 100, or leave it blank.');
        return;
      }
      remainingPercent = num;
    }

    // Determine resetAt timestamp
    let resetAt: string;

    if (flowMode === 'new') {
      if (!hasResetTime) {
        // Use default 1 hour if reset time not explicitly set
        const result = buildRelativeResetAt(0, DEFAULT_RESET_HOURS, 0);
        if (!result) {
          setError('Could not compute default reset time.');
          return;
        }
        resetAt = result;
      } else {
        if (resetMode === 'exact') {
          const calDate = parseTextDate(exactDate);
          if (!calDate) {
            setError('Enter a valid date in MM/DD/YYYY format.');
            return;
          }
          const normalizedTime = parseTextTime(exactTime);
          if (!normalizedTime) {
            setError('Enter a valid time in hh:mm AM/PM format.');
            return;
          }
          const result = buildExactResetAt(
            calDate,
            normalizedTime,
            account.defaultTimezone,
          );
          if (!result) {
            setError('Choose a reset date and time in the future.');
            return;
          }
          resetAt = result;
        } else {
          const d = Number(days) || 0;
          const h = Number(hours) || 0;
          const m = Number(minutes) || 0;
          const result = buildRelativeResetAt(d, h, m);
          if (!result) {
            setError('Enter a reset duration of at least 1 minute.');
            return;
          }
          resetAt = result;
        }
      }
    } else {
      // Edit mode
      if (!selectedQuota) return;

      if (!isEditingReset) {
        // Preserve existing resetAt EXACTLY if not changed
        resetAt = selectedQuota.resetAt;
      } else {
        if (resetMode === 'exact') {
          const calDate = parseTextDate(exactDate);
          if (!calDate) {
            setError('Enter a valid date in MM/DD/YYYY format.');
            return;
          }
          const normalizedTime = parseTextTime(exactTime);
          if (!normalizedTime) {
            setError('Enter a valid time in hh:mm AM/PM format.');
            return;
          }
          const result = buildExactResetAt(
            calDate,
            normalizedTime,
            selectedQuota.timezone,
          );
          if (!result) {
            setError('Choose a reset date and time in the future.');
            return;
          }
          resetAt = result;
        } else {
          const d = Number(days) || 0;
          const h = Number(hours) || 0;
          const m = Number(minutes) || 0;
          const result = buildRelativeResetAt(d, h, m);
          if (!result) {
            setError('Enter a reset duration of at least 1 minute.');
            return;
          }
          resetAt = result;
        }
      }
    }

    if (!resetAt) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (flowMode === 'new') {
        const saved = await agentUsageGateway.saveQuota({
          accountId: selectedAccountId!,
          label: label.trim(),
          remainingPercent,
          reminders: {
            beforeResetHours: null,
            resetDay: false,
            resetReached: remindResetReached,
          },
          resetAt,
          timezone: account.defaultTimezone,
          trackingSource: 'manual',
        });
        setSavedQuota(saved);
      } else {
        // Edit mode - pass existing quota ID and preserve hidden reminder fields
        const saved = await agentUsageGateway.saveQuota({
          id: selectedQuota!.id,
          accountId: selectedAccountId!,
          label: label.trim(),
          remainingPercent,
          reminders: {
            beforeResetHours: selectedQuota!.reminders.beforeResetHours,
            resetDay: selectedQuota!.reminders.resetDay,
            resetReached: remindResetReached,
          },
          resetAt,
          timezone: selectedQuota!.timezone,
          trackingSource:
            selectedQuota!.trackingSource === 'pasted' ? 'pasted' : 'manual',
        });
        setSavedQuota(saved);
      }
      // Emit event to refresh main Agent Usage page
      await invokeCommand('emit_agent_usage_changed');
    } catch (err) {
      const errorMessage = commandError(
        err,
        `The quota window could not be ${flowMode === 'new' ? 'saved' : 'updated'}.`,
      );
      if (
        errorMessage.toLowerCase().includes('label') ||
        errorMessage.toLowerCase().includes('duplicate')
      ) {
        setError(
          `A "${label.trim()}" quota window already exists for this account.`,
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    flowMode,
    selectedAccountId,
    selectedQuotaId,
    selectedQuota,
    label,
    remaining,
    accounts,
    hasResetTime,
    isEditingReset,
    resetMode,
    exactDate,
    exactTime,
    days,
    hours,
    minutes,
    remindResetReached,
  ]);

  const handleAddAnother = useCallback(() => {
    resetFormFields();
  }, [resetFormFields]);

  const handleEditAnother = useCallback(() => {
    setSelectedQuotaId(null);
    resetFormFields();
    void loadAccounts();
  }, [resetFormFields, loadAccounts]);

  const handleOpenAgentUsage = useCallback(() => {
    void openAgentUsageFromQuickAccess();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <button
            aria-label="Back to Quick Actions"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wide">
              Back
            </span>
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Spinner aria-label="Loading Agent Usage accounts" size="sm" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <button
            aria-label="Back to Quick Actions"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wide">
              Back
            </span>
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <h3 className="font-mono text-xs font-semibold text-foreground">
            No Agent Usage accounts yet
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add an Agent Usage account before managing quota windows.
          </p>
          <button
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:border-accent/40"
            onClick={handleOpenAgentUsage}
            style={{ backgroundColor: 'var(--panel)' }}
            type="button"
          >
            <IconExternalLink className="h-3.5 w-3.5 text-accent" />
            Open Agent Usage
          </button>
        </div>
      </div>
    );
  }

  if (savedQuota) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <button
            aria-label="Back to Quick Actions"
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide">
              Back
            </span>
          </button>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
            {flowMode === 'new' ? 'Add Quota Window' : 'Edit Quota Window'}
          </span>
          <button
            aria-label="Close"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
          <IconCircleCheck className="h-10 w-10 text-success" />
          <h3 className="mt-2.5 font-mono text-xs font-semibold text-foreground">
            {flowMode === 'new' ? 'Quota window added' : 'Quota window updated'}
          </h3>
          <p className="mt-1 font-mono text-xs font-bold text-accent">
            {savedQuota.label}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">
            {selectedAccount
              ? `${PLATFORM_LABELS[selectedAccount.platform] || selectedAccount.platform} · ${selectedAccount.identifier}`
              : ''}
          </p>
          {savedQuota.remainingPercent != null && (
            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
              {savedQuota.remainingPercent}% remaining
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
            Resets {formatResetSummary(savedQuota.resetAt, savedQuota.timezone)}
          </p>
          {savedQuota.reminders.resetReached && (
            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
              Reminder · When reset time is reached
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:border-accent/40"
              onClick={
                flowMode === 'new' ? handleAddAnother : handleEditAnother
              }
              style={{ backgroundColor: 'var(--panel)' }}
              type="button"
            >
              {flowMode === 'new' ? 'Add another' : 'Edit another'}
            </button>
            <button
              className="rounded-lg bg-accent px-4 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-accent/90"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Task Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <button
          aria-label="Back to Quick Actions"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <IconChevronLeft className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide">
            Back
          </span>
        </button>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          Quota Window
        </span>
        <button
          aria-label="Close"
          className="text-muted-foreground transition-colors hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mode Switcher Control Bar */}
      <div
        className="flex shrink-0 border-b border-border p-1 gap-1"
        style={{ backgroundColor: 'var(--panel)' }}
      >
        <button
          className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] font-medium transition-colors ${
            flowMode === 'new'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--elevated)]'
          }`}
          disabled={isSaving}
          onClick={() => handleSwitchFlowMode('new')}
          type="button"
        >
          + New quota
        </button>
        <button
          className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] font-medium transition-colors ${
            flowMode === 'edit'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground hover:bg-[var(--elevated)]'
          }`}
          disabled={isSaving}
          onClick={() => handleSwitchFlowMode('edit')}
          type="button"
        >
          Edit quota
        </button>
      </div>

      {/* Main Task Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div
            className="mb-2.5 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[11px] leading-relaxed text-danger font-mono"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Platform + Identifier Row */}
          <div className="grid grid-cols-2 gap-2">
            <ThemedSelect
              disabled={isSaving}
              label="Platform"
              options={platforms.map((p) => ({
                id: p,
                name: PLATFORM_LABELS[p] || p,
              }))}
              placeholder="Select platform..."
              selectedId={selectedPlatform}
              onSelect={handleSelectPlatform}
            />
            <ThemedSelect
              disabled={!selectedPlatform || isSaving}
              label="Identifier"
              options={platformAccounts.map((acc) => ({
                id: acc.id,
                name: acc.identifier,
              }))}
              placeholder="Select account..."
              selectedId={selectedAccountId}
              onSelect={handleSelectAccount}
            />
          </div>

          {/* Edit Mode: Quota Window Selector or Empty Quota State */}
          {flowMode === 'edit' &&
            selectedAccountId &&
            (accountQuotas.length === 0 ? (
              <div
                className="rounded-lg border border-border p-3 text-center space-y-2"
                style={{ backgroundColor: 'var(--panel)' }}
              >
                <p className="font-mono text-xs font-semibold text-foreground">
                  No quota windows for this account.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Create a quota window first.
                </p>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-mono text-xs font-medium text-white transition-colors hover:bg-accent/90"
                  onClick={() => handleSwitchFlowMode('new')}
                  type="button"
                >
                  <IconPlus className="h-3.5 w-3.5" />+ New quota
                </button>
              </div>
            ) : (
              <ThemedSelect
                disabled={isSaving}
                label="Quota Window"
                options={accountQuotas.map((q) => ({
                  id: q.id,
                  name: q.label,
                }))}
                placeholder="Select quota window..."
                selectedId={selectedQuotaId}
                onSelect={handleSelectQuota}
              />
            ))}

          {/* Render Form when (flowMode === 'new' && selectedAccountId) OR (flowMode === 'edit' && selectedQuotaId) */}
          {((flowMode === 'new' && selectedAccountId) ||
            (flowMode === 'edit' && selectedQuotaId)) && (
            <>
              {/* Quota Label + Remaining Row */}
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <div>
                  <label className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Quota Label
                  </label>
                  <input
                    ref={labelInputRef}
                    aria-label="Quota label"
                    className="h-9 w-full rounded-lg border border-border px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    disabled={isSaving}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        label.trim() &&
                        selectedAccountId
                      ) {
                        void handleSave();
                      }
                    }}
                    placeholder="Weekly"
                    style={{ backgroundColor: 'var(--panel)' }}
                    value={label}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Remaining
                  </label>
                  <div className="relative">
                    <input
                      aria-label="Remaining percentage"
                      className="h-9 w-full rounded-lg border border-border px-3 pr-8 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                      disabled={isSaving}
                      onChange={(e) => setRemaining(e.target.value)}
                      placeholder="Unknown"
                      style={{ backgroundColor: 'var(--panel)' }}
                      type="number"
                      value={remaining}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Reminders Section */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted font-mono">
                  Reminders
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    checked={remindResetReached}
                    className="h-4 w-4 rounded border-border bg-panel text-accent focus:ring-accent focus:ring-offset-0"
                    disabled={isSaving}
                    onChange={(e) => setRemindResetReached(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-[11px] text-foreground font-mono">
                    When reset time is reached
                  </span>
                </label>
              </div>

              {/* Reset Time Section */}
              {flowMode === 'new' ? (
                !hasResetTime ? (
                  <button
                    className="flex items-center gap-1.5 text-[11px] font-mono text-accent hover:text-accent/80 transition-colors"
                    disabled={isSaving}
                    onClick={handleSetResetTime}
                    type="button"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Set reset time
                  </button>
                ) : (
                  <ResetEditorPanel
                    days={days}
                    disabled={isSaving}
                    exactDate={exactDate}
                    exactTime={exactTime}
                    hours={hours}
                    minutes={minutes}
                    onCancelOrRemove={handleRemoveResetTime}
                    onDaysChange={handleDaysChange}
                    onExactDateChange={handleExactDateChange}
                    onExactTimeChange={handleExactTimeChange}
                    onHoursChange={handleHoursChange}
                    onMinutesChange={handleMinutesChange}
                    onModeChange={handleModeChange}
                    removeLabel="Remove reset time"
                    resetMode={resetMode}
                  />
                )
              ) : /* Edit Mode Reset Time Section */
              !isEditingReset ? (
                <div
                  className="rounded-lg border border-border p-3 space-y-1.5"
                  style={{ backgroundColor: 'var(--panel)' }}
                >
                  <span className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    RESET TIME
                  </span>
                  {selectedQuota && (
                    <p className="font-mono text-xs font-medium text-foreground">
                      {formatResetSummary(
                        selectedQuota.resetAt,
                        selectedQuota.timezone,
                      )}
                    </p>
                  )}
                  <button
                    className="flex items-center gap-1.5 text-[11px] font-mono text-accent hover:text-accent/80 transition-colors pt-0.5"
                    disabled={isSaving}
                    onClick={handleStartEditReset}
                    type="button"
                  >
                    Change reset time
                  </button>
                </div>
              ) : (
                <ResetEditorPanel
                  days={days}
                  disabled={isSaving}
                  exactDate={exactDate}
                  exactTime={exactTime}
                  hours={hours}
                  minutes={minutes}
                  onCancelOrRemove={handleCancelResetChange}
                  onDaysChange={handleDaysChange}
                  onExactDateChange={handleExactDateChange}
                  onExactTimeChange={handleExactTimeChange}
                  onHoursChange={handleHoursChange}
                  onMinutesChange={handleMinutesChange}
                  onModeChange={handleModeChange}
                  removeLabel="Cancel reset change"
                  resetMode={resetMode}
                />
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-1">
                <button
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-mono text-xs font-semibold text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    isSaving ||
                    !selectedAccountId ||
                    !label.trim() ||
                    (flowMode === 'edit' && !selectedQuotaId)
                  }
                  onClick={() => void handleSave()}
                  type="button"
                >
                  {isSaving ? (
                    <Spinner size="sm" />
                  ) : flowMode === 'new' ? (
                    <>
                      <IconPlus className="h-3.5 w-3.5" />
                      <span>Add quota</span>
                    </>
                  ) : (
                    <span>Save changes</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResetEditorPanel({
  resetMode,
  exactDate,
  exactTime,
  days,
  hours,
  minutes,
  disabled,
  removeLabel,
  onModeChange,
  onExactDateChange,
  onExactTimeChange,
  onDaysChange,
  onHoursChange,
  onMinutesChange,
  onCancelOrRemove,
}: {
  resetMode: ResetMode;
  exactDate: string;
  exactTime: string;
  days: string;
  hours: string;
  minutes: string;
  disabled: boolean;
  removeLabel: string;
  onModeChange: (mode: ResetMode) => void;
  onExactDateChange: (val: string) => void;
  onExactTimeChange: (val: string) => void;
  onDaysChange: (val: string) => void;
  onHoursChange: (val: string) => void;
  onMinutesChange: (val: string) => void;
  onCancelOrRemove: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-border p-3 space-y-3"
      style={{ backgroundColor: 'var(--panel)' }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted font-mono">
        RESET TIME
      </p>

      {/* Segmented Control */}
      <div
        className="flex rounded-lg border border-border p-0.5"
        style={{ backgroundColor: 'var(--elevated)' }}
      >
        <button
          className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] font-medium transition-colors ${
            resetMode === 'exact'
              ? 'bg-accent text-white'
              : 'text-foreground hover:bg-accent/10'
          }`}
          disabled={disabled}
          onClick={() => onModeChange('exact')}
          type="button"
        >
          Exact date & time
        </button>
        <button
          className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] font-medium transition-colors ${
            resetMode === 'relative'
              ? 'bg-accent text-white'
              : 'text-foreground hover:bg-accent/10'
          }`}
          disabled={disabled}
          onClick={() => onModeChange('relative')}
          type="button"
        >
          Reset in
        </button>
      </div>

      {/* Exact Date & Time Mode */}
      {resetMode === 'exact' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-muted-foreground font-mono mb-1">
              Reset date
            </label>
            <input
              aria-label="Reset date"
              className="h-8 w-full rounded border border-border px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={disabled}
              onChange={(e) => onExactDateChange(e.target.value)}
              style={{ backgroundColor: 'var(--panel)' }}
              type="date"
              value={exactDate}
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground font-mono mb-1">
              Reset time
            </label>
            <input
              aria-label="Reset time"
              className="h-8 w-full rounded border border-border px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={disabled}
              onChange={(e) => onExactTimeChange(e.target.value)}
              style={{ backgroundColor: 'var(--panel)' }}
              type="time"
              value={exactTime}
            />
          </div>
        </div>
      )}

      {/* Relative Mode */}
      {resetMode === 'relative' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-muted-foreground font-mono mb-1">
              Days
            </label>
            <input
              aria-label="Days"
              className="h-8 w-full rounded border border-border px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={disabled}
              min="0"
              onChange={(e) => onDaysChange(e.target.value)}
              type="number"
              value={days}
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground font-mono mb-1">
              Hours
            </label>
            <input
              aria-label="Hours"
              className="h-8 w-full rounded border border-border px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={disabled}
              min="0"
              onChange={(e) => onHoursChange(e.target.value)}
              type="number"
              value={hours}
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground font-mono mb-1">
              Minutes
            </label>
            <input
              aria-label="Minutes"
              className="h-8 w-full rounded border border-border px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={disabled}
              min="0"
              onChange={(e) => onMinutesChange(e.target.value)}
              type="number"
              value={minutes}
            />
          </div>
        </div>
      )}

      <button
        className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
        disabled={disabled}
        onClick={onCancelOrRemove}
        type="button"
      >
        {removeLabel}
      </button>
    </div>
  );
}

function ThemedSelect({
  label,
  placeholder,
  options,
  selectedId,
  onSelect,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === selectedId);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOptionClick = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <span className="block font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      <button
        aria-expanded={isOpen}
        aria-label={label}
        className={`flex h-9 w-full items-center justify-between rounded-lg border px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
          isOpen
            ? 'border-accent ring-1 ring-accent'
            : 'border-border hover:border-accent/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          backgroundColor: 'var(--panel)',
          color: 'var(--text-primary)',
        }}
        type="button"
      >
        <div className="flex items-center gap-2 truncate text-foreground">
          {selectedOption ? (
            <span className="truncate">{selectedOption.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border p-1 shadow-2xl"
          style={{
            backgroundColor: 'var(--elevated)',
            color: 'var(--text-primary)',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.id === selectedId;
              return (
                <button
                  key={opt.id}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-xs text-left transition-colors ${
                    isSelected
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-foreground hover:bg-[var(--panel)] hover:text-accent'
                  }`}
                  onClick={() => handleOptionClick(opt.id)}
                  style={{
                    backgroundColor: isSelected
                      ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                      : 'transparent',
                  }}
                  type="button"
                >
                  <span className="truncate flex-1">{opt.name}</span>
                  {isSelected && (
                    <IconCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function commandError(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
