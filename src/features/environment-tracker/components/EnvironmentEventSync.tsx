import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { environmentTrackerKeys } from '../hooks/use-environment-tracker';
import { environmentChangedPayloadSchema } from '../models/environment-tracker';

const ENVIRONMENT_CHANGED_EVENT = 'environment://changed';

export function EnvironmentEventSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlistenPromise = listen<unknown>(
      ENVIRONMENT_CHANGED_EVENT,
      (event) => {
        const payload = environmentChangedPayloadSchema.safeParse(
          event.payload,
        );
        if (!payload.success) return;
        void queryClient.invalidateQueries({
          queryKey: environmentTrackerKeys.project(payload.data.projectId),
        });
      },
    ).catch(() => undefined);

    return () => {
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [queryClient]);

  return null;
}
