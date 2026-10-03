import { Alert, Button, toast } from '@heroui/react';
import {
  IconAlertTriangle,
  IconBrandVscode,
  IconCheck,
  IconCopy,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { formatFileSize } from '../models/file-inventory';

const MAX_PREVIEW_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface MarkdownViewerProps {
  content: string;
  sizeBytes: number;
  relativePath: string;
  viewMode: 'rendered' | 'raw';
  searchQuery?: string;
  activeMatchIndex?: number;
  zoomLevel?: number;
  onMatchCountChange?: (count: number) => void;
  onOpenInVsCode?: () => void;
}

const MATCH_INACTIVE_CLASS =
  'rounded-xs bg-amber-300/40 dark:bg-amber-500/30 text-foreground px-0.5';
const MATCH_ACTIVE_CLASS =
  'rounded-xs bg-amber-400 dark:bg-amber-400 text-black font-bold px-0.5 ring-2 ring-amber-500 ring-offset-1 ring-offset-surface shadow-xs';

function updateActiveMatchInContainer(
  container: HTMLElement | null,
  activeIndex: number,
) {
  if (!container) return;
  const marks = container.querySelectorAll<HTMLElement>(
    'mark[data-markdown-match]',
  );
  marks.forEach((mark) => {
    const idx = Number(mark.getAttribute('data-match-index'));
    if (idx === activeIndex) {
      mark.setAttribute('data-active-match', 'true');
      mark.className = MATCH_ACTIVE_CLASS;
    } else {
      mark.removeAttribute('data-active-match');
      mark.className = MATCH_INACTIVE_CLASS;
    }
  });
  const activeEl = container.querySelector<HTMLElement>(
    '[data-active-match="true"]',
  );
  if (activeEl && typeof activeEl.scrollIntoView === 'function') {
    activeEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }
}

function isInsideNoSearch(node: Node, root: HTMLElement): boolean {
  let curr = node.parentElement;
  while (curr && curr !== root) {
    if (
      curr.hasAttribute('data-no-search') ||
      curr.hasAttribute('data-line-number') ||
      curr.tagName === 'BUTTON'
    ) {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

function highlightInContainer(
  container: HTMLElement | null,
  query: string,
  activeIndex: number,
): number {
  if (!container) return 0;

  // 1. Remove previous marks and restore text nodes
  const existingMarks = container.querySelectorAll<HTMLElement>(
    'mark[data-markdown-match]',
  );
  existingMarks.forEach((m) => {
    const parent = m.parentNode;
    if (parent) {
      while (m.firstChild) {
        parent.insertBefore(m.firstChild, m);
      }
      parent.removeChild(m);
    }
  });
  container.normalize();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return 0;

  const doc = container.ownerDocument;
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (isInsideNoSearch(current, container)) {
      continue;
    }
    textNodes.push(current as Text);
  }

  let matchIdx = 0;
  const lowerQuery = trimmedQuery.toLowerCase();

  for (const node of textNodes) {
    const text = node.textContent ?? '';
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(lowerQuery);

    if (index === -1) continue;

    const parent = node.parentNode;
    if (!parent) continue;

    let lastIndex = 0;
    const fragment = doc.createDocumentFragment();

    while (index !== -1) {
      if (index > lastIndex) {
        fragment.appendChild(
          doc.createTextNode(text.substring(lastIndex, index)),
        );
      }

      const mark = doc.createElement('mark');
      mark.setAttribute('data-markdown-match', 'true');
      mark.setAttribute('data-match-index', String(matchIdx));
      if (matchIdx === activeIndex) {
        mark.setAttribute('data-active-match', 'true');
        mark.className = MATCH_ACTIVE_CLASS;
      } else {
        mark.className = MATCH_INACTIVE_CLASS;
      }
      mark.textContent = text.substring(index, index + trimmedQuery.length);
      fragment.appendChild(mark);

      matchIdx++;
      lastIndex = index + trimmedQuery.length;
      index = lowerText.indexOf(lowerQuery, lastIndex);
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.substring(lastIndex)));
    }

    parent.replaceChild(fragment, node);
  }

  const activeEl = container.querySelector<HTMLElement>(
    '[data-active-match="true"]',
  );
  if (activeEl && typeof activeEl.scrollIntoView === 'function') {
    activeEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  return matchIdx;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(element.props?.children);
  }
  return '';
}

const CodeBlock = memo(function CodeBlock({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'code'>) {
  const [copied, setCopied] = useState(false);
  const codeText = useMemo(() => {
    return extractText(children).replace(/\n$/, '');
  }, [children]);

  const handleCopy = useCallback(async () => {
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.danger('Could not copy code');
    }
  }, [codeText]);

  return (
    <div className="group relative my-3 rounded-lg border border-divider bg-surface-secondary/80 p-3">
      <Button
        aria-label={copied ? 'Code copied' : 'Copy code snippet'}
        className="absolute top-2 right-2 h-7 w-7 min-w-7 text-muted hover:text-foreground opacity-80 group-hover:opacity-100 transition-opacity bg-surface/80 hover:bg-surface border border-divider/60 shadow-xs"
        isIconOnly
        onPress={() => void handleCopy()}
        size="sm"
        variant="ghost"
      >
        {copied ? (
          <IconCheck
            aria-hidden="true"
            className="text-success"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        ) : (
          <IconCopy
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        )}
      </Button>
      <pre className="overflow-x-auto pr-9">
        <code
          className={`font-mono text-xs text-foreground select-text ${className ?? ''}`}
          {...props}
        >
          {children}
        </code>
      </pre>
    </div>
  );
});

const MARKDOWN_COMPONENTS = {
  a({ children, href }: React.ComponentPropsWithoutRef<'a'>) {
    return (
      <a
        className="text-accent hover:underline font-medium underline-offset-2"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: React.ComponentPropsWithoutRef<'blockquote'>) {
    return (
      <blockquote className="border-l-4 border-accent/60 pl-3 italic text-muted my-3 bg-surface-secondary/20 py-1.5 rounded-r text-sm">
        {children}
      </blockquote>
    );
  },
  pre({ children }: React.ComponentPropsWithoutRef<'pre'>) {
    return <>{children}</>;
  },
  code({
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<'code'>) {
    const isInline = !className && !String(children).includes('\n');
    if (isInline) {
      return (
        <code
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-secondary text-accent font-medium border border-divider/40 select-text"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <CodeBlock className={className} {...props}>
        {children}
      </CodeBlock>
    );
  },
  h1({ children }: React.ComponentPropsWithoutRef<'h1'>) {
    return (
      <h1 className="text-xl font-bold tracking-tight text-foreground pb-2 border-b border-divider mb-3 mt-5 first:mt-0 font-mono">
        {children}
      </h1>
    );
  },
  h2({ children }: React.ComponentPropsWithoutRef<'h2'>) {
    return (
      <h2 className="text-lg font-semibold tracking-tight text-foreground pb-1.5 border-b border-divider/60 mb-2 mt-4 font-mono">
        {children}
      </h2>
    );
  },
  h3({ children }: React.ComponentPropsWithoutRef<'h3'>) {
    return (
      <h3 className="text-base font-semibold text-foreground mb-2 mt-3 font-mono">
        {children}
      </h3>
    );
  },
  h4({ children }: React.ComponentPropsWithoutRef<'h4'>) {
    return (
      <h4 className="text-sm font-semibold text-foreground mb-1 mt-2 font-mono">
        {children}
      </h4>
    );
  },
  hr() {
    return <hr className="my-4 border-divider" />;
  },
  input({ type, checked, disabled }: React.ComponentPropsWithoutRef<'input'>) {
    if (type === 'checkbox') {
      return (
        <input
          checked={checked}
          className="mr-2 rounded border-divider text-accent focus:ring-accent"
          disabled={disabled}
          readOnly
          type="checkbox"
        />
      );
    }
    return <input type={type} />;
  },
  li({ children }: React.ComponentPropsWithoutRef<'li'>) {
    return (
      <li className="text-foreground/90 leading-relaxed text-sm">{children}</li>
    );
  },
  ol({ children }: React.ComponentPropsWithoutRef<'ol'>) {
    return (
      <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm">
        {children}
      </ol>
    );
  },
  p({ children }: React.ComponentPropsWithoutRef<'p'>) {
    return (
      <p className="text-sm leading-relaxed text-foreground/90 mb-3">
        {children}
      </p>
    );
  },
  table({ children }: React.ComponentPropsWithoutRef<'table'>) {
    return (
      <div className="my-4 overflow-x-auto rounded-md border border-divider">
        <table className="w-full text-left border-collapse text-xs">
          {children}
        </table>
      </div>
    );
  },
  tbody({ children }: React.ComponentPropsWithoutRef<'tbody'>) {
    return <tbody className="divide-y divide-divider/60">{children}</tbody>;
  },
  td({ children }: React.ComponentPropsWithoutRef<'td'>) {
    return (
      <td className="px-3 py-2 text-foreground/90 align-top">{children}</td>
    );
  },
  th({ children }: React.ComponentPropsWithoutRef<'th'>) {
    return (
      <th className="px-3 py-2 font-semibold font-mono bg-surface-secondary/70 text-foreground border-b border-divider">
        {children}
      </th>
    );
  },
  ul({ children }: React.ComponentPropsWithoutRef<'ul'>) {
    return (
      <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm">
        {children}
      </ul>
    );
  },
};

const REMARK_PLUGINS = [remarkGfm];

export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  sizeBytes,
  relativePath,
  viewMode,
  searchQuery = '',
  activeMatchIndex = 0,
  zoomLevel = 100,
  onMatchCountChange,
  onOpenInVsCode,
}: MarkdownViewerProps) {
  const isTooLarge = sizeBytes > MAX_PREVIEW_SIZE_BYTES;
  const rawLines = useMemo(() => content.split('\n'), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(relativePath);

  useEffect(() => {
    if (previousPathRef.current !== relativePath) {
      previousPathRef.current = relativePath;
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [relativePath]);

  const activeMatchIndexRef = useRef(activeMatchIndex);
  activeMatchIndexRef.current = activeMatchIndex;

  // Full highlight run when content, mode, or query changes
  useEffect(() => {
    const count = highlightInContainer(
      containerRef.current,
      searchQuery,
      activeMatchIndexRef.current,
    );
    onMatchCountChange?.(count);
  }, [content, viewMode, searchQuery, onMatchCountChange]);

  // Fast-path active match switch when activeMatchIndex changes
  useEffect(() => {
    updateActiveMatchInContainer(containerRef.current, activeMatchIndex);
  }, [activeMatchIndex]);

  if (isTooLarge) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <Alert className="max-w-md" role="alert" status="warning">
          <Alert.Indicator>
            <IconAlertTriangle
              aria-hidden="true"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>File too large to preview</Alert.Title>
            <Alert.Description>
              {relativePath} ({formatFileSize(sizeBytes)}) exceeds the 2 MB safe
              preview limit. You can open it in an external editor.
            </Alert.Description>
          </Alert.Content>
        </Alert>
        {onOpenInVsCode && (
          <Button
            className="mt-4"
            onPress={onOpenInVsCode}
            size="sm"
            variant="secondary"
          >
            <IconBrandVscode
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Open in VS Code
          </Button>
        )}
      </div>
    );
  }

  if (viewMode === 'raw') {
    return (
      <div
        aria-label="Raw Markdown content"
        className="h-full overflow-auto font-mono text-xs p-4 bg-surface text-foreground leading-relaxed select-text selection:bg-accent/30 selection:text-foreground"
        ref={containerRef}
        tabIndex={0}
      >
        <div
          className="table w-full select-text transition-[zoom] duration-100"
          style={{ zoom: zoomLevel / 100 }}
        >
          {rawLines.map((line, idx) => (
            <div className="table-row hover:bg-surface-secondary/50" key={idx}>
              <span
                className="table-cell select-none pr-4 text-right text-muted/60 text-[11px] align-top w-12 font-mono"
                data-line-number="true"
              >
                {idx + 1}
              </span>
              <span className="table-cell whitespace-pre-wrap break-all font-mono select-text">
                {line || '\u00A0'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Rendered Markdown content"
      className="markdown-body h-full overflow-auto p-6 bg-surface text-foreground select-text selection:bg-accent/30 selection:text-foreground space-y-3 max-w-none text-sm leading-relaxed"
      ref={containerRef}
      tabIndex={0}
    >
      <div
        className="transition-[zoom] duration-100"
        style={{ zoom: zoomLevel / 100 }}
      >
        <ReactMarkdown
          components={MARKDOWN_COMPONENTS}
          remarkPlugins={REMARK_PLUGINS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});
