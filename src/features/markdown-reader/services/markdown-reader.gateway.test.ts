import { describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  DOCUMENT_CHANGED_EVENT,
  markdownReaderGateway,
} from './markdown-reader.gateway';

vi.mock('@/shared/infrastructure/tauri/invoke-client', () => ({
  invokeCommand: vi.fn(),
}));

let capturedListener: (() => void) | null = null;
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event: string, callback: () => void) => {
    capturedListener = callback;
    return Promise.resolve(() => {
      capturedListener = null;
    });
  }),
}));

describe('markdownReaderGateway', () => {
  it('parses valid markdown document payload from invoke', async () => {
    const rawPayload = {
      content: '# Title\nHello world',
      fileName: 'README.md',
      modifiedAtMs: 1700000000000,
      path: 'C:/docs/README.md',
      sizeBytes: 25,
    };

    vi.mocked(invokeCommand).mockResolvedValue(rawPayload);

    const doc = await markdownReaderGateway.getDocument();
    expect(invokeCommand).toHaveBeenCalledWith('get_markdown_reader_document');
    expect(doc).toEqual(rawPayload);
  });

  it('rejects invalid payloads missing required fields', async () => {
    vi.mocked(invokeCommand).mockResolvedValue({
      fileName: 'incomplete.md',
    });

    await expect(markdownReaderGateway.getDocument()).rejects.toThrow();
  });

  it('subscribes to document changed events and unlistens', async () => {
    const callback = vi.fn();
    const unlisten = await markdownReaderGateway.onDocumentChanged(callback);

    expect(listen).toHaveBeenCalledWith(
      DOCUMENT_CHANGED_EVENT,
      expect.any(Function),
    );
    expect(capturedListener).toBeTruthy();
    capturedListener?.();
    expect(callback).toHaveBeenCalledTimes(1);

    unlisten();
    expect(capturedListener).toBeNull();
  });
});
