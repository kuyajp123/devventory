import { convertFileSrc } from '@tauri-apps/api/core';
import { IconKey } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  predefinedSourceLogo,
  type CredentialSource,
} from '../models/credential-vault';

export function SourceLogo({
  className = 'h-9 w-9',
  source,
}: {
  className?: string;
  source: Pick<CredentialSource, 'definitionKey' | 'iconPath' | 'name'>;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSource = useMemo(() => {
    const bundled = predefinedSourceLogo(source.definitionKey);
    if (bundled) return bundled;
    if (!source.iconPath) return null;
    try {
      return convertFileSrc(source.iconPath);
    } catch {
      return null;
    }
  }, [source.definitionKey, source.iconPath]);

  if (imageSource && failedSource !== imageSource) {
    return (
      <img
        alt=""
        className={`${className} shrink-0 rounded-md object-cover`}
        onError={() => setFailedSource(imageSource)}
        src={imageSource}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent/10 text-accent`}
    >
      <IconKey className="h-1/2 w-1/2" stroke={ICON_STROKE} />
    </span>
  );
}
