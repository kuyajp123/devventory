import { mockIPC } from '@tauri-apps/api/mocks';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_REQUEST,
  type SearchMetadataRequest,
} from '../models/search';
import { searchGateway } from './search.gateway';

describe('searchGateway', () => {
  it('passes the complete bounded request and validates the response', async () => {
    const request = {
      ...DEFAULT_SEARCH_REQUEST,
      origins: ['managed'],
      query: 'logo',
    } satisfies SearchMetadataRequest;
    mockIPC((command, args) => {
      expect(command).toBe('search_metadata');
      expect(args).toEqual({ request });
      return {
        hasMore: false,
        items: [
          {
            category: 'image',
            extension: 'png',
            id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
            modifiedAtMs: 1_770_000_000_000,
            name: 'logo.png',
            note: null,
            origin: 'managed',
            projectId: 'ab89c0c5-7749-41cb-9394-e884454f5077',
            projectName: 'Devventory',
            relativePath: 'assets/logo.png',
            resultType: 'file',
            status: 'active',
            tags: ['brand'],
          },
        ],
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
      };
    });

    await expect(searchGateway.search(request)).resolves.toMatchObject({
      totalItems: 1,
      items: [{ resultType: 'file' }],
    });
  });

  it('rejects malformed search history responses', async () => {
    mockIPC(() => [{ id: 'not-a-uuid' }]);

    await expect(searchGateway.history()).rejects.toThrow();
  });
});
