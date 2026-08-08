import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  searchHistoryEntrySchema,
  searchHistorySchema,
  searchMetadataPageSchema,
  type SearchMetadataRequest,
} from '../models/search';

export const searchGateway = {
  async search(request: SearchMetadataRequest) {
    const response = await invokeCommand<unknown>('search_metadata', {
      request,
    });
    return searchMetadataPageSchema.parse(response);
  },

  async recordHistory(request: SearchMetadataRequest) {
    const response = await invokeCommand<unknown>('record_search_history', {
      request,
    });
    return searchHistoryEntrySchema.nullable().parse(response);
  },

  async history() {
    const response = await invokeCommand<unknown>('list_search_history');
    return searchHistorySchema.parse(response);
  },

  async deleteHistory(historyId: string) {
    await invokeCommand<void>('delete_search_history', { historyId });
  },

  async clearHistory() {
    await invokeCommand<void>('clear_search_history');
  },
};
