import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { credentialVaultKeys } from '../hooks/use-credential-vault';

export function CredentialVaultNavigationSync() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const navigateUnlistenPromise = listen(
      'credential-vault://navigate',
      () => {
        void navigate('/credential-vault');
      },
    ).catch(() => undefined);

    const changedUnlistenPromise = listen('credential-vault://changed', () => {
      void queryClient.invalidateQueries({
        queryKey: credentialVaultKeys.all,
      });
    }).catch(() => undefined);

    return () => {
      void navigateUnlistenPromise.then((unlisten) => unlisten?.());
      void changedUnlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [navigate, queryClient]);

  return null;
}
