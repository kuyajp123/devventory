/**
 * Checks whether a keyboard event corresponds to a browser/webview devtools,
 * source-view, reload, or context menu shortcut.
 */
export function isDevToolsShortcut(event: KeyboardEvent): boolean {
  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform?.toUpperCase().includes('MAC') ||
      navigator.userAgent?.toUpperCase().includes('MAC'));
  const isModifier = isMac ? event.metaKey : event.ctrlKey;
  const isAlt = event.altKey;

  // F12 (DevTools)
  if (event.key === 'F12') {
    return true;
  }

  // Ctrl+Shift+I / Cmd+Option+I / Cmd+Shift+I (Toggle DevTools)
  if (
    (isModifier &&
      event.shiftKey &&
      (event.key === 'I' || event.key === 'i')) ||
    (event.metaKey && isAlt && (event.key === 'I' || event.key === 'i'))
  ) {
    return true;
  }

  // Ctrl+Shift+J / Cmd+Option+J / Cmd+Shift+J (Open Console)
  if (
    (isModifier &&
      event.shiftKey &&
      (event.key === 'J' || event.key === 'j')) ||
    (event.metaKey && isAlt && (event.key === 'J' || event.key === 'j'))
  ) {
    return true;
  }

  // Ctrl+Shift+C / Cmd+Option+C / Cmd+Shift+C (Inspect Element)
  if (
    (isModifier &&
      event.shiftKey &&
      (event.key === 'C' || event.key === 'c')) ||
    (event.metaKey && isAlt && (event.key === 'C' || event.key === 'c'))
  ) {
    return true;
  }

  // Ctrl+U / Cmd+Option+U (View Page Source)
  if (
    (isModifier && (event.key === 'U' || event.key === 'u')) ||
    (event.metaKey && isAlt && (event.key === 'U' || event.key === 'u'))
  ) {
    return true;
  }

  // Keyboard context menu: Shift+F10 or ContextMenu key
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    return true;
  }

  // F5 or Ctrl+R / Cmd+R (Page reload)
  if (
    event.key === 'F5' ||
    (isModifier && (event.key === 'R' || event.key === 'r'))
  ) {
    return true;
  }

  return false;
}

/**
 * Disables the default webview/browser context menu and devtools shortcuts
 * in production environments while leaving them enabled in development for
 * inspection and debugging.
 */
export function setupContextMenuPrevention(
  isProduction: boolean = import.meta.env.PROD,
): () => void {
  if (!isProduction) {
    return () => {};
  }

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isDevToolsShortcut(event)) {
      event.preventDefault();
    }
  };

  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
