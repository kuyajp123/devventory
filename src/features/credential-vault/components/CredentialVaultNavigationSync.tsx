import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export function CredentialVaultNavigationSync() {
  const navigate = useNavigate();

  useEffect(() => {
    const unlistenPromise = listen('credential-vault://navigate', () => {
      void navigate('/credential-vault');
    }).catch(() => undefined);
    return () => {
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [navigate]);

  return null;
}
