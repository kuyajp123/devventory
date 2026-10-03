import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  type MarkdownDocument,
  markdownDocumentSchema,
} from '../models/markdown-document';

export const DOCUMENT_CHANGED_EVENT = 'markdown-reader:document-changed';

export const markdownReaderGateway = {
  async getDocument(): Promise<MarkdownDocument> {
    const response = await invokeCommand<unknown>(
      'get_markdown_reader_document',
    );
    return markdownDocumentSchema.parse(response);
  },

  async onDocumentChanged(callback: () => void): Promise<UnlistenFn> {
    return listen(DOCUMENT_CHANGED_EVENT, () => {
      callback();
    });
  },
};
