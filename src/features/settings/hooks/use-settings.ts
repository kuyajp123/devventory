import { toast } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BackgroundStartupPreferences,
  NotificationPreferences,
} from '../models/settings';
import { settingsGateway } from '../services/settings.gateway';

const NOTIFICATION_PREFERENCES_KEY = ['settings', 'notifications'];
const BACKGROUND_STARTUP_PREFERENCES_KEY = ['settings', 'background-startup'];

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryFn: () => settingsGateway.getNotificationPreferences(),
    queryKey: NOTIFICATION_PREFERENCES_KEY,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    NotificationPreferences,
    { previous?: NotificationPreferences }
  >({
    mutationFn: (input: NotificationPreferences) =>
      settingsGateway.saveNotificationPreferences(input),
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          NOTIFICATION_PREFERENCES_KEY,
          context.previous,
        );
      }
      toast.danger('Could not save notification preferences');
    },
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_PREFERENCES_KEY,
      });
      const previous = queryClient.getQueryData<NotificationPreferences>(
        NOTIFICATION_PREFERENCES_KEY,
      );
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_KEY, newPreferences);
      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATION_PREFERENCES_KEY,
      });
    },
  });
}

export function useBackgroundStartupPreferencesQuery() {
  return useQuery({
    queryFn: () => settingsGateway.getBackgroundStartupPreferences(),
    queryKey: BACKGROUND_STARTUP_PREFERENCES_KEY,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useUpdateBackgroundStartupPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    BackgroundStartupPreferences,
    { previous?: BackgroundStartupPreferences }
  >({
    mutationFn: (input: BackgroundStartupPreferences) =>
      settingsGateway.saveBackgroundStartupPreferences(input),
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          BACKGROUND_STARTUP_PREFERENCES_KEY,
          context.previous,
        );
      }
      toast.danger('Could not save background and startup preferences');
    },
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({
        queryKey: BACKGROUND_STARTUP_PREFERENCES_KEY,
      });
      const previous = queryClient.getQueryData<BackgroundStartupPreferences>(
        BACKGROUND_STARTUP_PREFERENCES_KEY,
      );
      queryClient.setQueryData(
        BACKGROUND_STARTUP_PREFERENCES_KEY,
        newPreferences,
      );
      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: BACKGROUND_STARTUP_PREFERENCES_KEY,
      });
    },
  });
}
