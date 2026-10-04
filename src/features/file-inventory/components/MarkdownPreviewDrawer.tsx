import { useAssetActionMutation } from '@/features/asset-library';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { Alert, Button, Input, Spinner, toast, Tooltip } from '@heroui/react';
import {
  IconArrowDown,
  IconArrowUp,
  IconBrandVscode,
  IconCopy,
  IconFileCode,
  IconMaximize,
  IconMinimize,
  IconSearch,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useProjectFileContentQuery } from '../hooks/use-file-inventory';
import type { IndexedFile } from '../models/file-inventory';
import { MarkdownViewer } from './MarkdownViewer';

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 100;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

interface MarkdownPreviewDrawerProps {
  className?: string;
  file: IndexedFile;
  projectId: string;
  onClose: () => void;
}

export const MarkdownPreviewDrawer = memo(function MarkdownPreviewDrawer({
  className,
  file,
  projectId,
  onClose,
}: MarkdownPreviewDrawerProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fileContentQuery = useProjectFileContentQuery(projectId, file.id);
  const assetAction = useAssetActionMutation(projectId, file.id);
  const markdownContent = fileContentQuery.data?.content;

  // Reset search and match tracking when active file changes
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
    setMatchCount(0);
  }, [file.id]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM);
  }, []);

  const handleNextMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  const handlePrevMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const handleMatchCountChange = useCallback((count: number) => {
    setMatchCount(count);
    setActiveMatchIndex((prev) => (count > 0 ? Math.min(prev, count - 1) : 0));
  }, []);

  const handleCopy = useCallback(async () => {
    if (!markdownContent) return;
    try {
      await navigator.clipboard.writeText(markdownContent);
      toast.success('Markdown content copied to clipboard');
    } catch {
      toast.danger('Could not copy markdown to clipboard');
    }
  }, [markdownContent]);

  const handleOpenInVsCode = useCallback(async () => {
    try {
      await assetAction.mutateAsync('open_in_vscode');
      toast.success('Opening file in VS Code');
    } catch (error) {
      toast.danger(
        error instanceof TauriCommandError
          ? error.message
          : 'Could not open file in VS Code.',
      );
    }
  }, [assetAction]);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSearchQuery('');
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts: Escape to close/minimize, Ctrl+F for search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      if (event.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        } else if (isMaximized) {
          setIsMaximized(false);
        } else {
          onClose();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isMaximized, onClose]);

  return (
    <aside
      aria-label={`Markdown preview for ${file.name}`}
      className={`bg-surface border-divider flex flex-col z-30 overflow-hidden transition-all duration-200 ${
        isMaximized
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : `sticky top-4 self-start max-h-[calc(100vh-2rem)] w-96 lg:w-[28rem] xl:w-[34rem] 2xl:w-[38rem] shrink-0 shadow-2xl ${className ?? 'h-full border-l'}`
      }`}
    >
      {/* Header Toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-divider px-3 gap-2 bg-surface">
        {/* File info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <IconFileCode
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="truncate font-mono text-xs font-semibold text-foreground">
                {file.name}
              </h2>
              {fileContentQuery.isFetching && !fileContentQuery.isPending && (
                <Spinner aria-label="Refreshing file content" size="sm" />
              )}
            </div>
            <p className="truncate font-mono text-[10px] text-muted">
              {file.relativePath}
            </p>
          </div>
        </div>

        {/* View mode toggle (Rendered vs Raw) */}
        <div className="flex items-center rounded-md border border-divider p-0.5 bg-surface-secondary/40 shrink-0">
          <button
            aria-pressed={viewMode === 'rendered'}
            className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
              viewMode === 'rendered'
                ? 'bg-surface text-foreground font-semibold shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setViewMode('rendered')}
            type="button"
          >
            Rendered
          </button>
          <button
            aria-pressed={viewMode === 'raw'}
            className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
              viewMode === 'raw'
                ? 'bg-surface text-foreground font-semibold shadow-xs'
                : 'text-muted hover:text-foreground'
            }`}
            onClick={() => setViewMode('raw')}
            type="button"
          >
            Raw
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center rounded-md border border-divider p-0.5 bg-surface-secondary/40 shrink-0">
          {zoomLevel > DEFAULT_ZOOM && (
            <Tooltip delay={0}>
              <Button
                aria-label="Reset zoom to default"
                className="h-6 w-6 min-w-6 px-6 text-accent hover:text-foreground"
                onPress={handleResetZoom}
                size="sm"
                variant="ghost"
              >
                <p>reset</p>
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Reset zoom to {DEFAULT_ZOOM}%</p>
              </Tooltip.Content>
            </Tooltip>
          )}
          <Tooltip delay={0}>
            <Button
              aria-label="Decrease zoom"
              className="h-6 w-6 min-w-6 p-0 text-muted hover:text-foreground"
              isDisabled={zoomLevel <= MIN_ZOOM}
              isIconOnly
              onPress={handleZoomOut}
              size="sm"
              variant="ghost"
            >
              <IconZoomOut
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>Zoom out (Min {MIN_ZOOM}%)</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <button
              aria-label={`Current zoom ${zoomLevel}%. Click to reset to ${DEFAULT_ZOOM}%`}
              className={`px-1.5 py-0.5 font-mono text-[11px] rounded transition-colors ${
                zoomLevel > DEFAULT_ZOOM
                  ? 'text-accent font-semibold hover:bg-surface cursor-pointer'
                  : 'text-muted cursor-default'
              }`}
              disabled={zoomLevel <= DEFAULT_ZOOM}
              onClick={handleResetZoom}
              type="button"
            >
              {zoomLevel}%
            </button>
            <Tooltip.Content placement="bottom">
              <p>
                {zoomLevel > DEFAULT_ZOOM
                  ? `Reset zoom to ${DEFAULT_ZOOM}%`
                  : `Default zoom (${DEFAULT_ZOOM}%)`}
              </p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <Button
              aria-label="Increase zoom"
              className="h-6 w-6 min-w-6 p-0 text-muted hover:text-foreground"
              isDisabled={zoomLevel >= MAX_ZOOM}
              isIconOnly
              onPress={handleZoomIn}
              size="sm"
              variant="ghost"
            >
              <IconZoomIn
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>Zoom in (Max {MAX_ZOOM}%)</p>
            </Tooltip.Content>
          </Tooltip>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip delay={0}>
            <Button
              aria-label="Find in document"
              isIconOnly
              onPress={toggleSearch}
              size="sm"
              variant={isSearchOpen ? 'secondary' : 'ghost'}
            >
              <IconSearch
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>Find in document (Ctrl+F)</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <Button
              aria-label="Copy Markdown"
              isIconOnly
              onPress={() => void handleCopy()}
              size="sm"
              variant="ghost"
            >
              <IconCopy
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>Copy Markdown</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <Button
              aria-label="Open in VS Code"
              isIconOnly
              onPress={() => void handleOpenInVsCode()}
              size="sm"
              variant="ghost"
            >
              <IconBrandVscode
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            </Button>
            <Tooltip.Content placement="bottom">
              <p>Open in VS Code</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip delay={0}>
            <Button
              aria-label={
                isMaximized ? 'Restore to drawer' : 'Expand to full view'
              }
              isIconOnly
              onPress={() => setIsMaximized((prev) => !prev)}
              size="sm"
              variant="ghost"
            >
              {isMaximized ? (
                <IconMinimize
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              ) : (
                <IconMaximize
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              )}
            </Button>
            <Tooltip.Content placement="bottom">
              <p>{isMaximized ? 'Restore to drawer' : 'Expand to full view'}</p>
            </Tooltip.Content>
          </Tooltip>

          <Button
            aria-label="Close Markdown preview"
            isIconOnly
            onPress={onClose}
            size="sm"
            variant="ghost"
          >
            <IconX
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
          </Button>
        </div>
      </header>

      {/* In-Document Search Bar */}
      {isSearchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-divider bg-surface-secondary/50">
          <div className="relative flex-1">
            <Input
              aria-label="Find in document input"
              className="w-full text-xs"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevMatch();
                  } else {
                    handleNextMatch();
                  }
                } else if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }
              }}
              placeholder="Find in document..."
              ref={searchInputRef}
              value={searchQuery}
            />
          </div>
          {searchQuery.trim() && (
            <span className="text-[11px] font-mono text-muted shrink-0 select-none">
              {matchCount > 0
                ? `${activeMatchIndex + 1} of ${matchCount}`
                : 'No results'}
            </span>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip delay={0}>
              <Button
                aria-label="Previous match"
                isDisabled={matchCount === 0}
                isIconOnly
                onPress={handlePrevMatch}
                size="sm"
                variant="ghost"
              >
                <IconArrowUp
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Previous match (Shift+Enter)</p>
              </Tooltip.Content>
            </Tooltip>

            <Tooltip delay={0}>
              <Button
                aria-label="Next match"
                isDisabled={matchCount === 0}
                isIconOnly
                onPress={handleNextMatch}
                size="sm"
                variant="ghost"
              >
                <IconArrowDown
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Next match (Enter)</p>
              </Tooltip.Content>
            </Tooltip>

            <Tooltip delay={0}>
              <Button
                aria-label="Close search"
                isIconOnly
                onPress={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                size="sm"
                variant="ghost"
              >
                <IconX
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Close (Escape)</p>
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-hidden relative select-text">
        {fileContentQuery.isPending && !fileContentQuery.data && (
          <div
            aria-label="Loading Markdown content"
            className="flex h-full items-center justify-center space-x-2 text-muted"
            role="status"
          >
            <Spinner size="md" />
            <span className="text-xs font-mono">Loading markdown…</span>
          </div>
        )}

        {fileContentQuery.isError && (
          <div className="p-6">
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Markdown preview unavailable</Alert.Title>
                <Alert.Description>
                  {fileContentQuery.error instanceof TauriCommandError
                    ? fileContentQuery.error.message
                    : 'The file could not be read from the project root.'}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        )}

        {fileContentQuery.data && (
          <MarkdownViewer
            activeMatchIndex={activeMatchIndex}
            content={fileContentQuery.data.content}
            key={`${file.id}:${viewMode}`}
            onMatchCountChange={handleMatchCountChange}
            onOpenInVsCode={handleOpenInVsCode}
            relativePath={file.relativePath}
            searchQuery={searchQuery}
            sizeBytes={fileContentQuery.data.sizeBytes}
            viewMode={viewMode}
            zoomLevel={zoomLevel}
          />
        )}
      </div>
    </aside>
  );
});
