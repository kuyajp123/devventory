import { describe, expect, it } from 'vitest';
import { getFolderBreadcrumbs } from './inventory-tree';

describe('getFolderBreadcrumbs', () => {
  it('uses the explicit live-filesystem root path', () => {
    expect(getFolderBreadcrumbs('.', 'Devventory')).toEqual([
      { name: 'Devventory', path: '.' },
    ]);
  });

  it('builds navigable project-relative segments', () => {
    expect(getFolderBreadcrumbs('src/components', 'Devventory')).toEqual([
      { name: 'Devventory', path: '.' },
      { name: 'src', path: 'src' },
      { name: 'components', path: 'src/components' },
    ]);
  });

  it('normalizes Windows separators without exposing an absolute path', () => {
    expect(getFolderBreadcrumbs('src\\components', 'Devventory')).toEqual([
      { name: 'Devventory', path: '.' },
      { name: 'src', path: 'src' },
      { name: 'components', path: 'src/components' },
    ]);
  });
});
