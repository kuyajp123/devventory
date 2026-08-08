import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_REQUEST } from './search';
import { composeSearchRequest } from './search-filter-request';

describe('composeSearchRequest', () => {
  it('normalizes and composes every supported metadata filter', () => {
    expect(
      composeSearchRequest(DEFAULT_SEARCH_REQUEST, {
        category: 'image',
        environmentId: '9cdbf276-41b2-4289-b330-d8d46b31ae30',
        extension: '.PNG, svg, png',
        modifiedFrom: '2026-08-01',
        modifiedTo: '2026-08-09',
        origin: 'managed',
        projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        query: '  logo  ',
        status: 'active',
        tags: 'Brand, approved, brand',
      }),
    ).toEqual(
      expect.objectContaining({
        categories: ['image'],
        environmentIds: ['9cdbf276-41b2-4289-b330-d8d46b31ae30'],
        extensions: ['png', 'svg'],
        modifiedFromMs: new Date('2026-08-01T00:00:00').getTime(),
        modifiedToMs: new Date('2026-08-09T23:59:59.999').getTime(),
        origins: ['managed'],
        page: 1,
        projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        query: 'logo',
        statuses: ['active'],
        tags: ['brand', 'approved'],
      }),
    );
  });
});
