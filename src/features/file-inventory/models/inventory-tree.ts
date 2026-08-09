export interface FolderBreadcrumbSegment {
  name: string;
  path: string;
}

export function getFolderBreadcrumbs(
  rawFolderPath: string,
  rootName: string,
): FolderBreadcrumbSegment[] {
  const folderPath = rawFolderPath.replace(/\\/g, '/');
  const crumbs: FolderBreadcrumbSegment[] = [{ name: rootName, path: '.' }];

  if (!folderPath || folderPath === '.') return crumbs;

  const segments = folderPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    crumbs.push({ name: segment, path: currentPath });
  }

  return crumbs;
}
