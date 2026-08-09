import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DEFAULT_PROJECT_EXCLUSIONS } from '../models/project';
import { folderPickerGateway } from '../services/folder-picker.gateway';
import { projectsGateway } from '../services/projects.gateway';
import { ProjectOnboardingPage } from './ProjectOnboardingPage';

const activeProjectMocks = vi.hoisted(() => ({
  selectProject: vi.fn(async () => undefined),
}));

vi.mock('../hooks/use-active-project', () => ({
  useActiveProject: () => ({ selectProject: activeProjectMocks.selectProject }),
}));
vi.mock('../services/folder-picker.gateway', () => ({
  folderPickerGateway: { selectProjectRoot: vi.fn() },
}));
vi.mock('../services/projects.gateway', () => ({
  projectsGateway: {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    scan: vi.fn(),
    validateRoot: vi.fn(),
  },
}));

const projectId = 'd2949d63-3df0-4ced-9460-5a821174f280';
const scanSummary = {
  completed: true,
  directoriesVisited: 8,
  durationMs: 24,
  entriesExcluded: 3,
  entriesUnreadable: 0,
  filesDiscovered: 42,
};

describe('ProjectOnboardingPage', () => {
  beforeEach(() => {
    activeProjectMocks.selectProject.mockClear();
    vi.mocked(folderPickerGateway.selectProjectRoot).mockResolvedValue(
      'C:\\workspace\\devventory',
    );
    vi.mocked(projectsGateway.validateRoot).mockResolvedValue({
      rootPath: 'C:\\workspace\\devventory',
    });
    vi.mocked(projectsGateway.scan).mockResolvedValue(scanSummary);
    vi.mocked(projectsGateway.create).mockResolvedValue({
      createdAt: '2026-08-01T00:00:00.000Z',
      description: 'Offline inventory',
      exclusions: [],
      id: projectId,
      initialScan: scanSummary,
      name: 'Devventory',
      projectType: 'desktop',
      rootPath: 'C:\\workspace\\devventory',
      updatedAt: '2026-08-01T00:00:00.000Z',
      watchedLocations: ['.'],
    });
  });

  it('selects and validates a folder, reviews a scan, and activates the project', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<ProjectOnboardingPage />} />
          <Route path="/dashboard" element={<h1>Project saved</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Watched locations')).toHaveValue('.');
    expect(screen.getByText('Built-in exclusions')).toBeVisible();
    for (const exclusion of DEFAULT_PROJECT_EXCLUSIONS) {
      expect(screen.getByText(exclusion)).toBeVisible();
    }
    expect(screen.getByLabelText('Additional exclusions')).toHaveValue('');
    await user.type(screen.getByLabelText('Project name'), 'Devventory');
    await user.type(
      screen.getByLabelText('Description (optional)'),
      'Offline inventory',
    );
    await user.click(screen.getByRole('button', { name: /Project type/ }));
    await user.click(
      screen.getByRole('option', { name: 'Desktop application' }),
    );
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(await screen.findByText('Folder validated')).toBeVisible();
    expect(screen.getByDisplayValue('C:\\workspace\\devventory')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Run initial scan' }));
    expect(
      await screen.findByRole('heading', { name: 'Scan summary' }),
    ).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
    expect(
      await screen.findByText('Initial project scan completed'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save project' }));
    expect(
      await screen.findByRole('heading', { name: 'Project saved' }),
    ).toBeVisible();
    expect(activeProjectMocks.selectProject).toHaveBeenCalledWith(projectId);
    expect(projectsGateway.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Devventory',
        projectType: 'desktop',
        rootPath: 'C:\\workspace\\devventory',
        watchedLocations: ['.'],
      }),
    );
    expect(
      await screen.findByText('Project saved to this device'),
    ).toBeVisible();
  }, 10_000);
});
