import { toast } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import type { Environment } from '../models/environment';
import {
  getPersistedPendingDeletions,
  removePendingDeletionRecord,
  savePendingDeletionRecord,
} from '../services/pending-environment-deletion-storage';
import { useDeleteEnvironmentMutation } from './use-environments';

const UNDO_DURATION_SECONDS = 5;

export interface PendingDeletionState {
  environment: Environment;
  secondsRemaining: number;
}

export function usePendingEnvironmentDeletion(
  projectId: string,
  onFinalized?: (environmentId: string) => void,
) {
  const [pending, setPending] = useState<PendingDeletionState | null>(null);
  const deleteMutation = useDeleteEnvironmentMutation(projectId);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingDeletionState | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finalizeDelete = useCallback(
    async (environment: Environment) => {
      clearTimers();
      removePendingDeletionRecord(projectId, environment.id);
      setPending(null);
      try {
        await deleteMutation.mutateAsync(environment.id);
        onFinalized?.(environment.id);
        toast.success(`Environment "${environment.name}" deleted`);
      } catch (error) {
        const message =
          error instanceof TauriCommandError
            ? error.message
            : 'The environment could not be deleted.';
        toast.danger(message);
      }
    },
    [clearTimers, deleteMutation, onFinalized, projectId],
  );

  const startPendingDeletion = useCallback(
    (environment: Environment) => {
      // If another deletion is pending, immediately finalize it first
      if (pendingRef.current) {
        void finalizeDelete(pendingRef.current.environment);
      }

      // Persist to localStorage BEFORE updating React state / hiding UI
      savePendingDeletionRecord(projectId, environment);

      clearTimers();
      setPending({ environment, secondsRemaining: UNDO_DURATION_SECONDS });

      timerRef.current = setInterval(() => {
        setPending((current) => {
          if (!current || current.secondsRemaining <= 1) {
            return current;
          }
          return {
            ...current,
            secondsRemaining: current.secondsRemaining - 1,
          };
        });
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        void finalizeDelete(environment);
      }, UNDO_DURATION_SECONDS * 1000);
    },
    [clearTimers, finalizeDelete, projectId],
  );

  const undoPendingDeletion = useCallback(() => {
    if (!pendingRef.current) return;
    removePendingDeletionRecord(projectId, pendingRef.current.environment.id);
    clearTimers();
    setPending(null);
    toast.success('Environment deletion cancelled');
  }, [clearTimers, projectId]);

  const reconciledProjectIdRef = useRef<string | null>(null);

  // Reconcile pending deletions leftover from previous application sessions
  useEffect(() => {
    if (!projectId || reconciledProjectIdRef.current === projectId) return;
    reconciledProjectIdRef.current = projectId;

    const persisted = getPersistedPendingDeletions();
    const staleRecords = persisted.filter(
      (item) => item.projectId === projectId,
    );
    for (const record of staleRecords) {
      removePendingDeletionRecord(record.projectId, record.environmentId);
      void deleteMutation.mutateAsync(record.environmentId).then(
        () => onFinalized?.(record.environmentId),
        () => {
          /* swallow error on startup cleanup */
        },
      );
    }
  }, [deleteMutation, onFinalized, projectId]);

  // Clean up timers on unmount / project change
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers, projectId]);

  return {
    isPendingDelete: Boolean(pending),
    pending,
    pendingEnvironmentId: pending?.environment.id ?? null,
    startPendingDeletion,
    undoPendingDeletion,
  };
}
