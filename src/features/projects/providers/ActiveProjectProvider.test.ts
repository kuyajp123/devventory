import { describe, expect, it } from 'vitest';
import type { Project } from '../models/project';
import { resolveInitialProjectId } from './ActiveProjectProvider';

const firstProject = project(
  '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  'First project',
);
const secondProject = project(
  '784b3f9a-34e0-4ad5-877d-e2dc5ef90f52',
  'Second project',
);

describe('resolveInitialProjectId', () => {
  it('restores a valid last-opened project', () => {
    expect(
      resolveInitialProjectId([firstProject, secondProject], secondProject.id),
    ).toBe(secondProject.id);
  });

  it('falls back to the first project when the stored project is stale', () => {
    expect(
      resolveInitialProjectId(
        [firstProject, secondProject],
        'c74f4e5b-c496-4237-b470-a3e93730fc95',
      ),
    ).toBe(firstProject.id);
  });

  it('keeps selection empty when no projects exist', () => {
    expect(resolveInitialProjectId([], firstProject.id)).toBeNull();
  });
});

function project(id: string, name: string): Project {
  return {
    createdAt: '2026-08-01T00:00:00.000Z',
    description: null,
    exclusions: [],
    id,
    initialScan: {
      completed: true,
      directoriesVisited: 1,
      durationMs: 1,
      entriesExcluded: 0,
      entriesUnreadable: 0,
      filesDiscovered: 1,
    },
    name,
    projectType: 'desktop',
    rootPath: `C:\\workspace\\${name}`,
    updatedAt: '2026-08-01T00:00:00.000Z',
    watchedLocations: ['.'],
  };
}
