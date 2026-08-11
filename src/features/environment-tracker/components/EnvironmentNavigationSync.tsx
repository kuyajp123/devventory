import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

const payloadSchema = z.object({ environmentId: z.string().uuid() }).strict();

export function EnvironmentNavigationSync() {
  const navigate = useNavigate();

  useEffect(() => {
    const unlistenPromise = listen<unknown>(
      'environment://open-custom-sources',
      (event) => {
        const result = payloadSchema.safeParse(event.payload);
        if (!result.success) return;
        void navigate('/environments', {
          state: {
            customEnvironmentSettingsId: result.data.environmentId,
          },
        });
      },
    ).catch(() => undefined);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [navigate]);

  return null;
}
