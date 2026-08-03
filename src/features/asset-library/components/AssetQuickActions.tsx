import { Button, Spinner, toast } from '@heroui/react';
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

const ACTIONS: Array<{
  action: QuickAction;
  icon: typeof IconCopy;
  label: string;
}> = [
  {
    action: 'open',
    icon: IconExternalLink,
    label: 'Open',
  },
  {
    action: 'reveal',
    icon: IconFolderOpen,
    label: 'Reveal',
  },
  {
    action: 'open_in_vscode',
    icon: IconBrandVscode,
    label: 'Open in VS Code',
  },
  {
    action: 'copy_relative_path',
    icon: IconCopy,
    label: 'Copy relative path',
  },
  {
    action: 'copy_absolute_path',
    icon: IconCopy,
    label: 'Copy absolute path',
  },
];

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
    <div className="flex flex-wrap items-center gap-2">
      {action.isPending && (
        <Spinner aria-label="Running file action" size="sm" />
      )}
      {ACTIONS.map((item) => (
        <Button
          key={item.action}
          onPress={() => void run(item.action)}
          size="sm"
          variant="secondary"
        >
          <item.icon
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          {item.label}
        </Button>
      ))}
    </div>
  );
}
