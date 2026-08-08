import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { invalidateDerivedProjectQueries } from '@/shared/query/derived-query-keys';
import { validationKeys } from '../hooks/use-validation-center';
import { validationChangedPayloadSchema } from '../models/validation';

const VALIDATION_CHANGED_EVENT = 'validation://changed';

export function ValidationEventSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlistenPromise = listen<unknown>(
      VALIDATION_CHANGED_EVENT,
      (event) => {
        const payload = validationChangedPayloadSchema.safeParse(event.payload);
        if (!payload.success) return;
        void queryClient.invalidateQueries({
          queryKey: validationKeys.project(payload.data.projectId),
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
