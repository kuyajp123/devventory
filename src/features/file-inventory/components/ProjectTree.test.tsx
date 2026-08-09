import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { fileInventoryGateway } from '../services/file-inventory.gateway';
import { ProjectTree } from './ProjectTree';

vi.mock('../services/file-inventory.gateway', () => ({
  fileInventoryGateway: {
    listDirectory: vi.fn(),
  },
}));

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';

function directoryPage(
  items: Array<{
    isWatched: boolean;
    name: string;
    relativePath: string;
  }>,
) {
  return {
    entriesUnreadable: 0,
    hasMore: false,
    items,
    page: 1,
    pageSize: 100,
    totalItems: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  };
}

describe('ProjectTree', () => {
  beforeEach(() => {
    vi.mocked(fileInventoryGateway.listDirectory).mockImplementation(
      async (_projectId, relativePath) => {
        if (relativePath === '.') {
          return directoryPage([
            { isWatched: true, name: 'assets', relativePath: 'assets' },
            {
              isWatched: false,
              name: 'empty-folder',
              relativePath: 'empty-folder',
            },
          ]);
        }
        if (relativePath === 'assets') {
          return directoryPage([
            {
              isWatched: false,
              name: 'branding',
              relativePath: 'assets/branding',
            },
          ]);
        }
        return directoryPage([]);
      },
    );
  });

  it('loads direct children lazily and supports selection and collapse', async () => {
    const user = userEvent.setup();
    const onSelectFolder = vi.fn();
    renderWithProviders(
      <ProjectTree
        onSelectFolder={onSelectFolder}
        projectId={projectId}
        projectName="Devventory"
        rootIsWatched
        selectedPath="."
      />,
    );

    expect(await screen.findByText('empty-folder')).toBeVisible();
    expect(fileInventoryGateway.listDirectory).toHaveBeenCalledWith(
      projectId,
      '.',
      1,
      100,
    );
    expect(
      screen.getAllByRole('treeitem', { name: /watched location/ }),
    ).toHaveLength(2);
    expect(fileInventoryGateway.listDirectory).not.toHaveBeenCalledWith(
      projectId,
      'assets',
      1,
      100,
    );

    await user.click(screen.getByRole('button', { name: 'Expand assets' }));
    expect(await screen.findByText('branding')).toBeVisible();
    expect(fileInventoryGateway.listDirectory).toHaveBeenCalledWith(
      projectId,
      'assets',
      1,
      100,
    );

    await user.click(screen.getByRole('button', { name: 'assets' }));
    expect(onSelectFolder).toHaveBeenCalledWith('assets');

    await user.click(screen.getByRole('button', { name: 'Collapse assets' }));
    expect(screen.queryByText('branding')).not.toBeInTheDocument();
  });

  it('keeps a node-level loading and error state separate from the inventory', async () => {
    let rejectRoot: ((reason?: unknown) => void) | undefined;
    vi.mocked(fileInventoryGateway.listDirectory).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRoot = reject;
        }),
    );

    renderWithProviders(
      <ProjectTree
        onSelectFolder={vi.fn()}
        projectId={projectId}
        projectName="Devventory"
        rootIsWatched={false}
        selectedPath="."
      />,
    );

    const loading = screen.getByRole('status', {
      name: 'Loading folders in Devventory',
    });
    expect(loading).toBeVisible();
    await waitFor(() => expect(rejectRoot).toBeTypeOf('function'));
    rejectRoot?.(new Error('permission denied'));
    await waitForElementToBeRemoved(loading);
    expect(screen.getByText('This directory could not be read.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
