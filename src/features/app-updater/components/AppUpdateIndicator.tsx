import { Button } from '@heroui/react';
import { IconDownload, IconLoader2 } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import {
  useAppUpdaterStore,
  isAppUpdateBusy,
} from '../stores/app-updater.store';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

/**
 * AppUpdateIndicator shows in the top bar when an update is available or actively being processed.
 * It appears only when status is 'available', 'downloading', 'installing', or 'relaunching'.
 */
export function AppUpdateIndicator() {
  const status = useAppUpdaterStore((state) => state.status);
  const availableUpdate = useAppUpdaterStore((state) => state.availableUpdate);
  const downloadProgress = useAppUpdaterStore((state) => state.download);
  const { openUpdateModal } = useAppUpdaterActions();
  const navigate = useNavigate();

  const isBusy = isAppUpdateBusy(status);

  // Only show when update is available or actively being processed
  if (
    status === 'idle' ||
    status === 'checking' ||
    status === 'upToDate' ||
    status === 'error'
  ) {
    return null;
  }

  if (!availableUpdate) {
    return null;
  }

  const getLabel = () => {
    if (status === 'downloading') {
      const percent = downloadProgress.percentage;
      if (percent !== null) {
        return `Downloading update: ${Math.round(percent)}%`;
      }
      return 'Downloading update...';
    }
    if (status === 'installing') {
      return 'Installing update...';
    }
    if (status === 'relaunching') {
      return 'Restarting Devventory...';
    }
    return `Update available: Devventory ${availableUpdate.version}`;
  };

  const getVisibleText = () => {
    if (status === 'downloading') {
      const percent = downloadProgress.percentage;
      if (percent !== null) {
        return `${Math.round(percent)}%`;
      }
      return 'Downloading...';
    }
    if (status === 'installing') {
      return 'Installing...';
    }
    if (status === 'relaunching') {
      return 'Restarting...';
    }
    return `Update ${availableUpdate.version}`;
  };

  const handlePress = () => {
    if (isBusy) {
      openUpdateModal();
    } else {
      void navigate('/settings/about-updates');
    }
  };

  return (
    <Button
      aria-label={getLabel()}
      className="h-7 gap-1.5 px-2.5 text-xs font-medium"
      isDisabled={false}
      isIconOnly={false}
      onPress={handlePress}
      size="sm"
      variant="primary"
    >
      {isBusy ? (
        <IconLoader2
          aria-hidden="true"
          className="animate-spin"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
      ) : (
        <IconDownload
          aria-hidden="true"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
      )}
      <span className="hidden sm:inline">{getVisibleText()}</span>
    </Button>
  );
}
