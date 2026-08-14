import type { ClipboardEvent } from 'react';

/**
 * Native textarea values normalize pasted CRLF line endings to LF. Secret
 * values must retain the clipboard payload exactly, so the controlled state is
 * updated from ClipboardEvent before the browser mutates the textarea value.
 */
export function preserveExactTextareaPaste(
  event: ClipboardEvent<HTMLTextAreaElement>,
  currentValue: string,
  onValue: (value: string) => void,
) {
  const pastedValue = event.clipboardData.getData('text/plain');
  const start = event.currentTarget.selectionStart ?? currentValue.length;
  const end = event.currentTarget.selectionEnd ?? start;
  event.preventDefault();
  onValue(
    `${currentValue.slice(0, start)}${pastedValue}${currentValue.slice(end)}`,
  );
}
