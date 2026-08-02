import { Button, Card, Spinner, toast } from '@heroui/react';
import {
  IconBrandVscode,
  IconCopy,
  IconExternalLink,
  IconFolderOpen,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { useAssetActionMutation } from '../hooks/use-assets';
import type { QuickAction } from '../models/asset';

export function AssetQuickActions({
  assetId,
  projectId,
}: {
  assetId: string;
  projectId: string;
}) {
  const action = useAssetActionMutation(projectId, assetId);

  async function run(nextAction: QuickAction) {
    try {
      const value = await action.mutateAsync(nextAction);
      if (value !== null) {
        await navigator.clipboard.writeText(value);
        toast.success('Path copied to clipboard');
      } else {
        toast.success('File action started');
      }
    } catch (error) {
      toast.danger(
        error instanceof TauriCommandError
          ? error.message
          : 'That file action could not be completed.',
      );
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Quick actions</Card.Title>
        <Card.Description>
          Paths are revalidated inside the project before every native action.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-wrap gap-3">
        {action.isPending && (
          <Spinner aria-label="Running file action" size="sm" />
        )}
        <ActionButton
          icon={IconExternalLink}
          label="Open"
          onPress={() => void run('open')}
        />
        <ActionButton
          icon={IconFolderOpen}
          label="Reveal"
          onPress={() => void run('reveal')}
        />
        <ActionButton
          icon={IconBrandVscode}
          label="Open in VS Code"
          onPress={() => void run('open_in_vscode')}
        />
        <ActionButton
          icon={IconCopy}
          label="Copy relative path"
          onPress={() => void run('copy_relative_path')}
        />
        <ActionButton
          icon={IconCopy}
          label="Copy absolute path"
          onPress={() => void run('copy_absolute_path')}
        />
      </Card.Content>
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof IconCopy;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button onPress={onPress} size="sm" variant="secondary">
      <Icon aria-hidden="true" size={ICON_SIZE.button} stroke={ICON_STROKE} />
      {label}
    </Button>
  );
}
