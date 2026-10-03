import {
  Alert,
  Button,
  Input,
  Spinner,
  toast,
  Tooltip,
  useTheme,
} from '@heroui/react';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconFileCode,
  IconMoon,
  IconSearch,
  IconSun,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { formatFileSize, MarkdownViewer } from '@/features/file-inventory';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { useStandaloneMarkdownDocument } from '../hooks/use-standalone-markdown';

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 100;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export const StandaloneMarkdownReader = memo(
  function StandaloneMarkdownReader() {
    const {
      data: document,
      isPending,
      isError,
      error,
    } = useStandaloneMarkdownDocument();
    const { theme, setTheme } = useTheme();

    const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
    const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);
    const [matchCount, setMatchCount] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset search when document path changes
    useEffect(() => {
      setIsSearchOpen(false);
      setSearchQuery('');
      setActiveMatchIndex(0);
      setMatchCount(0);
    }, [document?.path]);

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
      setActiveMatchIndex((prev) =>
        count > 0 ? Math.min(prev, count - 1) : 0,
      );
    }, []);

    const handleCopyMarkdown = useCallback(async () => {
      if (!document?.content) return;
      try {
        await navigator.clipboard.writeText(document.content);
        toast.success('Markdown content copied to clipboard');
      } catch {
        toast.danger('Could not copy markdown to clipboard');
      }
    }, [document?.content]);

    const handleCopyPath = useCallback(async () => {
      if (!document?.path) return;
      try {
        await navigator.clipboard.writeText(document.path);
        toast.success('File path copied to clipboard');
      } catch {
        toast.danger('Could not copy file path');
      }
    }, [document?.path]);

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

    const toggleTheme = useCallback(() => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setTheme]);

    // Keyboard shortcuts: Escape to close search, Ctrl+F for search
    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'f'
        ) {
          event.preventDefault();
          setIsSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return;
        }

        if (event.key === 'Escape') {
          if (isSearchOpen) {
            setIsSearchOpen(false);
            setSearchQuery('');
          }
        }
      }

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen]);

    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        {/* Top Header / Toolbar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-divider px-4 gap-3 bg-surface select-none">
          {/* File metadata */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <IconFileCode
              aria-hidden="true"
              className="shrink-0 text-accent"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="truncate font-mono text-sm font-semibold text-foreground">
                  {document?.fileName ?? 'Markdown Document'}
                </h1>
                {document && (
                  <span className="shrink-0 rounded-xs bg-surface-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {formatFileSize(document.sizeBytes)}
                  </span>
                )}
              </div>
              {document && (
                <Tooltip delay={0}>
                  <p
                    className="truncate font-mono text-[11px] text-muted cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => void handleCopyPath()}
                  >
                    {document.path}
                  </p>
                  <Tooltip.Content placement="bottom">
                    <p>Click to copy path</p>
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>

          {/* View mode toggle (Rendered vs Raw) */}
          <div className="flex items-center rounded-md border border-divider p-0.5 bg-surface-secondary/40 shrink-0">
            <button
              aria-pressed={viewMode === 'rendered'}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
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
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
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
            <Tooltip delay={0}>
              <Button
                aria-label="Decrease zoom"
                className="h-7 w-7 min-w-7 p-0 text-muted hover:text-foreground"
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
                className={`px-2 py-0.5 font-mono text-xs rounded transition-colors ${
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
                className="h-7 w-7 min-w-7 p-0 text-muted hover:text-foreground"
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

            {zoomLevel > DEFAULT_ZOOM && (
              <Tooltip delay={0}>
                <Button
                  aria-label="Reset zoom to default"
                  className="h-7 w-7 min-w-7 p-0 text-accent hover:text-foreground"
                  isIconOnly
                  onPress={handleResetZoom}
                  size="sm"
                  variant="ghost"
                >
                  <IconZoomReset
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                </Button>
                <Tooltip.Content placement="bottom">
                  <p>Reset zoom to {DEFAULT_ZOOM}%</p>
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-1 shrink-0">
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
                  size={ICON_SIZE.button}
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
                onPress={() => void handleCopyMarkdown()}
                size="sm"
                variant="ghost"
              >
                <IconCopy
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Copy Markdown</p>
              </Tooltip.Content>
            </Tooltip>

            <Tooltip delay={0}>
              <Button
                aria-label={`Toggle theme (current: ${theme})`}
                isIconOnly
                onPress={toggleTheme}
                size="sm"
                variant="ghost"
              >
                {theme === 'dark' ? (
                  <IconSun
                    aria-hidden="true"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                ) : (
                  <IconMoon
                    aria-hidden="true"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                )}
              </Button>
              <Tooltip.Content placement="bottom">
                <p>Toggle light/dark theme</p>
              </Tooltip.Content>
            </Tooltip>
          </div>
        </header>

        {/* In-Document Search Bar */}
        {isSearchOpen && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-divider bg-surface-secondary/50">
            <div className="relative flex-1 max-w-md">
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
            <div className="flex items-center gap-1 shrink-0">
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

        {/* Content Viewer */}
        <main className="min-h-0 flex-1 overflow-hidden relative select-text">
          {isPending && !document && (
            <div
              aria-label="Loading Markdown document"
              className="flex h-full items-center justify-center space-x-2 text-muted"
              role="status"
            >
              <Spinner size="md" />
              <span className="text-xs font-mono">Loading markdown…</span>
            </div>
          )}

          {isError && (
            <div className="p-8 max-w-xl mx-auto">
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Markdown document unavailable</Alert.Title>
                  <Alert.Description>
                    {error instanceof TauriCommandError
                      ? error.message
                      : 'The file could not be read or does not exist.'}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </div>
          )}

          {document && (
            <MarkdownViewer
              activeMatchIndex={activeMatchIndex}
              content={document.content}
              onMatchCountChange={handleMatchCountChange}
              relativePath={document.fileName}
              searchQuery={searchQuery}
              sizeBytes={document.sizeBytes}
              viewMode={viewMode}
              zoomLevel={zoomLevel}
            />
          )}
        </main>
      </div>
    );
  },
);
