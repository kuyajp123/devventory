import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppUiStore } from '@/app/stores/app-ui.store';
import { renderWithProviders } from '@/test/render';
import { GlobalCommandPalette } from './GlobalCommandPalette';

const projectState = vi.hoisted(() => ({
  activeProject: null as null | { id: string; name: string },
  projects: [] as Array<{ id: string; name: string }>,
  selectProject: vi.fn(),
}));

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProject: projectState.activeProject,
    projects: projectState.projects,
    selectProject: projectState.selectProject,
  }),
}));

function LocationProbe() {
  return <output>{useLocation().pathname + useLocation().search}</output>;
}

describe('GlobalCommandPalette', () => {
  beforeEach(() => {
    projectState.activeProject = null;
    projectState.projects = [];
    projectState.selectProject.mockReset();
    useAppUiStore.setState({ isCommandPaletteOpen: false });
  });

  it('keeps global commands available, hides project commands, and restores focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/dashboard']}>
        <button type="button">Palette trigger</button>
        <GlobalCommandPalette />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Palette trigger' });
    trigger.focus();

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByText('Open Agent Usage')).toBeVisible();
    expect(screen.getByText('Open Global Search')).toBeVisible();
    expect(screen.queryByText('Open File Inventory')).not.toBeInTheDocument();

    await user.type(screen.getByRole('combobox'), 'logo');
    await user.click(screen.getByText('Search Devventory for “logo”'));
    expect(screen.getByRole('status')).toHaveTextContent(
      '/search?scope=all&q=logo',
    );

    trigger.focus();
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('supports arrow and enter navigation plus active-project commands', async () => {
    const user = userEvent.setup();
    projectState.activeProject = { id: 'project-1', name: 'Current project' };
    projectState.projects = [
      { id: 'project-1', name: 'Current project' },
      { id: 'project-2', name: 'Other project' },
    ];
    renderWithProviders(
      <MemoryRouter initialEntries={['/dashboard']}>
        <GlobalCommandPalette />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByText('Open File Inventory')).toBeVisible();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('/agent-usage');

    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'Open File Inventory');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('/files');

    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'Other project');
    await user.keyboard('{Enter}');
    expect(projectState.selectProject).toHaveBeenCalledWith('project-2');
  });
});
