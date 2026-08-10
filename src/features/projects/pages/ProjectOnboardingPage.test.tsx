import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
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
  folderPickerGateway: {
    selectDirectory: vi.fn(),
    selectProjectRoot: vi.fn(),
  },
}));
vi.mock('../services/projects.gateway', () => ({
  projectsGateway: {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    scan: vi.fn(),
    validateRoot: vi.fn(),
    validateSubdirectory: vi.fn(),
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
    vi.mocked(folderPickerGateway.selectDirectory).mockResolvedValue(
      'C:\\workspace\\devventory',
    );
    vi.mocked(projectsGateway.validateRoot).mockResolvedValue({
      rootPath: 'C:\\workspace\\devventory',
    });
    vi.mocked(projectsGateway.validateSubdirectory).mockImplementation(
      async (_, targetPath) => {
        if (targetPath.includes('src')) return { relativePath: 'src/' };
        if (targetPath.includes('logs')) return { relativePath: 'logs/' };
        return { relativePath: '.' };
      },
    );
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

  it('renders onboarding workspace with Watch Scope, gates save project until scan, handles scope switching, and activates project', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<ProjectOnboardingPage />} />
          <Route path="/dashboard" element={<h1>Project saved</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial state check
    expect(screen.getAllByText('Watch scope').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Entire project').length).toBeGreaterThan(0);
    expect(screen.getByText('Selected folders')).toBeVisible();
    expect(screen.getByText('Built-in exclusions')).toBeVisible();

    // Watched folder list controls should NOT be visible in Entire project mode
    expect(screen.queryByRole('button', { name: 'Enter path' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Choose watched folder' }),
    ).toBeNull();

    // Save project button MUST NOT BE RENDERED in DOM before initial scan
    expect(screen.queryByRole('button', { name: 'Save project' })).toBeNull();

    // Fill project details
    await user.type(screen.getByLabelText('Project name'), 'Devventory');
    await user.type(
      screen.getByLabelText('Description (optional)'),
      'Offline inventory',
    );
    await user.click(screen.getByRole('button', { name: /Project type/ }));
    await user.click(
      screen.getByRole('option', { name: 'Desktop application' }),
    );

    // Choose project root
    await user.click(
      screen.getByRole('button', { name: 'Choose root folder' }),
    );
    expect(await screen.findByText('C:\\workspace\\devventory')).toBeVisible();
    expect(screen.getAllByText('Validated').length).toBeGreaterThan(0);

    // Run initial scan in Entire project mode
    await user.click(screen.getByRole('button', { name: 'Run initial scan' }));
    expect(
      await screen.findByRole('heading', { name: 'Initial scan' }),
    ).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();

    // Save project button renders in DOM after successful scan
    const saveButton = screen.getByRole('button', { name: 'Save project' });
    expect(saveButton).toBeVisible();

    // Switch to Selected folders mode -> invalidates scan and hides Save project button
    await user.click(screen.getByRole('button', { name: /Selected folders/ }));
    expect(screen.queryByRole('button', { name: 'Save project' })).toBeNull();
    expect(screen.getByText('Scan stale')).toBeVisible();

    // Watched folder list controls are NOW visible in Selected folders mode
    expect(screen.getByRole('button', { name: 'Enter path' })).toBeVisible();

    // Add manual watched folder in Selected folders mode
    await user.click(screen.getByRole('button', { name: 'Enter path' }));
    await user.type(
      screen.getByPlaceholderText('e.g. src/ or apps/web/'),
      'src/',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('src/')).toBeVisible();

    // Scan again in Selected folders mode
    await user.click(screen.getByRole('button', { name: 'Run initial scan' }));
    expect(
      await screen.findByRole('button', { name: 'Save project' }),
    ).toBeVisible();

    // Save project
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
        watchedLocations: ['src/'],
      }),
    );
  }, 15_000);

  it('resets selected folders draft and exclusions when project root changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<ProjectOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial folder selection
    await user.click(
      screen.getByRole('button', { name: 'Choose root folder' }),
    );
    expect(await screen.findByText('C:\\workspace\\devventory')).toBeVisible();
    expect(screen.getAllByText('Validated').length).toBeGreaterThan(0);

    // Switch to Selected folders mode & add custom folder
    await user.click(screen.getByRole('button', { name: /Selected folders/ }));
    await user.click(screen.getByRole('button', { name: 'Enter path' }));
    await user.type(
      screen.getByPlaceholderText('e.g. src/ or apps/web/'),
      'src/',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('src/')).toBeVisible();

    // Change folder to a new root
    vi.mocked(folderPickerGateway.selectDirectory).mockResolvedValue(
      'C:\\workspace\\another-project',
    );
    vi.mocked(projectsGateway.validateRoot).mockResolvedValue({
      rootPath: 'C:\\workspace\\another-project',
    });

    await user.click(
      screen.getByRole('button', { name: 'Change root folder' }),
    );
    expect(
      await screen.findByText('C:\\workspace\\another-project'),
    ).toBeVisible();

    // Custom watched location src/ should have been reset
    expect(screen.queryByText('src/')).toBeNull();
  });
});
