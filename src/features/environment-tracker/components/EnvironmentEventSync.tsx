import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { invalidateDerivedProjectQueries } from '@/shared/query/derived-query-keys';
import { environmentKeys } from '../hooks/use-environments';
import { environmentChangedPayloadSchema } from '../models/environment';

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
          queryKey: environmentKeys.project(payload.data.projectId),
        });
        void invalidateDerivedProjectQueries(
          queryClient,
          payload.data.projectId,
        );
      },
    ).catch(() => undefined);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [queryClient]);

  return null;
}
