import { useCallback, useId, useState } from 'react';
import { ProjectTreeNode } from './ProjectTreeNode';

interface ProjectTreeProps {
  projectId: string;
  projectName: string;
  rootIsWatched: boolean;
  selectedPath: string;
  onSelectFolder: (folderPath: string) => void;
}

export function ProjectTree({
  projectId,
  projectName,
  rootIsWatched,
  selectedPath,
  onSelectFolder,
}: ProjectTreeProps) {
  const treeId = useId();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['.']),
  );

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectFolder = useCallback(
    (path: string) => {
      setExpandedFolders((current) => {
        if (current.has(path)) return current;
        const next = new Set(current);
        next.add(path);
        return next;
      });
      onSelectFolder(path);
    },
    [onSelectFolder],
  );

  return (
    <ul
      aria-label="Live project directories"
      className="overflow-y-auto overflow-x-hidden py-1 text-xs"
      role="tree"
    >
      <ProjectTreeNode
        depth={0}
        expandedFolders={expandedFolders}
        isWatched={rootIsWatched}
        name={projectName}
        onSelect={selectFolder}
        onToggle={toggleFolder}
        path="."
        projectId={projectId}
        selectedPath={selectedPath}
        treeId={treeId}
      />
    </ul>
  );
}
