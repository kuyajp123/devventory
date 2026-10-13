import { Button, Input, Label, TextField } from '@heroui/react';
import { useState } from 'react';
import type {
  ConfigureCloudSync,
  CloudSyncStatus,
} from '@/features/cloud-sync/models/cloud-sync';

export function CloudConnectionForm({
  status,
  busy,
  onSave,
}: {
  status: CloudSyncStatus;
  busy: boolean;
  onSave: (input: ConfigureCloudSync) => Promise<unknown>;
}) {
  const [apiUrl, setApiUrl] = useState(status.apiUrl);
  const [workspaceId, setWorkspaceId] = useState(status.workspaceId ?? '');
  const [deviceId, setDeviceId] = useState(status.deviceId ?? '');
  const [token, setToken] = useState('');
  return (
    <form
      className="space-y-4 rounded-md border border-divider bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          void onSave({
            apiUrl: apiUrl.trim(),
            workspaceId: workspaceId.trim(),
            deviceId: deviceId.trim(),
            publisherToken: token.trim() || null,
          })
            .then(() => setToken(''))
            .catch(() => {});
      }}
    >
      <h3 className="text-sm font-semibold">Cloud connection</h3>
      <TextField fullWidth isRequired variant="secondary">
        <Label>Worker URL</Label>
        <Input
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
          placeholder="https://devventory-sync.your-name.workers.dev"
          disabled={busy}
          required
        />
      </TextField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField fullWidth isRequired variant="secondary">
          <Label>Workspace ID</Label>
          <Input
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            disabled={busy}
            required
          />
        </TextField>
        <TextField fullWidth isRequired variant="secondary">
          <Label>Publisher device ID</Label>
          <Input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            disabled={busy}
            required
          />
        </TextField>
      </div>
      <TextField fullWidth variant="secondary">
        <Label>Publisher token</Label>
        <Input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={busy}
          required={!status.configured}
        />
      </TextField>
      <p className="text-xs text-muted">
        Use the IDs and token from the Cloudflare setup helper. The token is
        saved in Windows Credential Manager. Leave it blank to keep the saved
        token for the same Worker URL and IDs. A new destination requires its
        token.
      </p>
      <Button type="submit" variant="secondary" isDisabled={busy}>
        Save connection
      </Button>
    </form>
  );
}
