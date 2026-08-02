import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fileInventoryKeys } from '../hooks/use-file-inventory';
import { inventoryChangedPayloadSchema } from '../models/file-inventory';

const INVENTORY_CHANGED_EVENT = 'inventory://changed';

export function InventoryEventSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlistenPromise = listen<unknown>(
      INVENTORY_CHANGED_EVENT,
      (event) => {
        const payload = inventoryChangedPayloadSchema.safeParse(event.payload);
        if (!payload.success) return;

        void queryClient.invalidateQueries({
          queryKey: fileInventoryKeys.project(payload.data.projectId),
        });
      },
    ).catch(() => undefined);

    return () => {
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [queryClient]);

  return null;
}
