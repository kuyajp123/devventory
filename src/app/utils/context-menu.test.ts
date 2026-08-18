import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevToolsShortcut, setupContextMenuPrevention } from './context-menu';

describe('isDevToolsShortcut', () => {
  it('detects F12 as a devtools shortcut', () => {
    const event = new KeyboardEvent('keydown', { key: 'F12' });
    expect(isDevToolsShortcut(event)).toBe(true);
  });

  it('detects Ctrl+Shift+I as a devtools shortcut', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'I',
      shiftKey: true,
    });
    expect(isDevToolsShortcut(event)).toBe(true);
  });

  it('detects Ctrl+Shift+J as a console shortcut', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'J',
      shiftKey: true,
    });
    expect(isDevToolsShortcut(event)).toBe(true);
  });

  it('detects Ctrl+Shift+C as an inspect element shortcut', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'C',
      shiftKey: true,
    });
    expect(isDevToolsShortcut(event)).toBe(true);
  });

  it('detects Ctrl+U as a view source shortcut', () => {
    const event = new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'u',
    });
    expect(isDevToolsShortcut(event)).toBe(true);
  });

  it('detects Shift+F10 and ContextMenu key as context menu shortcuts', () => {
    expect(
      isDevToolsShortcut(
        new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }),
      ),
    ).toBe(true);
    expect(
      isDevToolsShortcut(new KeyboardEvent('keydown', { key: 'ContextMenu' })),
    ).toBe(true);
  });

  it('detects F5 and Ctrl+R as reload shortcuts', () => {
    expect(
      isDevToolsShortcut(new KeyboardEvent('keydown', { key: 'F5' })),
    ).toBe(true);
    expect(
      isDevToolsShortcut(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'r' }),
      ),
    ).toBe(true);
  });

  it('allows normal typing and shortcuts like Ctrl+C, Ctrl+V, Ctrl+F, Escape', () => {
    expect(
      isDevToolsShortcut(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'c' }),
      ),
    ).toBe(false);
    expect(
      isDevToolsShortcut(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'v' }),
      ),
    ).toBe(false);
    expect(
      isDevToolsShortcut(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'f' }),
      ),
    ).toBe(false);
    expect(
      isDevToolsShortcut(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).toBe(false);
    expect(
      isDevToolsShortcut(new KeyboardEvent('keydown', { key: 'Enter' })),
    ).toBe(false);
  });
});

describe('setupContextMenuPrevention', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it('prevents default right-click context menu in production', () => {
    cleanup = setupContextMenuPrevention(true);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents devtools and reload keyboard shortcuts in production', () => {
    cleanup = setupContextMenuPrevention(true);

    const f12Event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'F12',
    });
    const f12Spy = vi.spyOn(f12Event, 'preventDefault');
    document.dispatchEvent(f12Event);
    expect(f12Spy).toHaveBeenCalledTimes(1);

    const ctrlShiftI = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'I',
      shiftKey: true,
    });
    const ctrlShiftISpy = vi.spyOn(ctrlShiftI, 'preventDefault');
    document.dispatchEvent(ctrlShiftI);
    expect(ctrlShiftISpy).toHaveBeenCalledTimes(1);
  });

  it('does not prevent default context menu or shortcuts in development', () => {
    cleanup = setupContextMenuPrevention(false);

    const mouseEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    const mouseSpy = vi.spyOn(mouseEvent, 'preventDefault');
    document.dispatchEvent(mouseEvent);
    expect(mouseSpy).not.toHaveBeenCalled();

    const keyEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'F12',
    });
    const keySpy = vi.spyOn(keyEvent, 'preventDefault');
    document.dispatchEvent(keyEvent);
    expect(keySpy).not.toHaveBeenCalled();
  });

  it('restores default behavior when cleanup is called', () => {
    cleanup = setupContextMenuPrevention(true);
    cleanup();
    cleanup = null;

    const mouseEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    const mouseSpy = vi.spyOn(mouseEvent, 'preventDefault');
    document.dispatchEvent(mouseEvent);
    expect(mouseSpy).not.toHaveBeenCalled();

    const keyEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'F12',
    });
    const keySpy = vi.spyOn(keyEvent, 'preventDefault');
    document.dispatchEvent(keyEvent);
    expect(keySpy).not.toHaveBeenCalled();
  });
});
