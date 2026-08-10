import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AppProviders } from './AppProviders';

function createActiveProjectContext() {
  return {
    activeProject: null,
    activeProjectId: null,
    hasProjects: false,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [],
    selectProject: vi.fn(),
  };
}

vi.mock('@/features/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/projects')>();

  return {
    ...actual,
    ProjectSelector: () => null,
    useActiveProject: createActiveProjectContext,
  };
});

vi.mock('@/features/projects/hooks/use-active-project', () => ({
  useActiveProject: createActiveProjectContext,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('AppProviders and App hierarchy', () => {
  it('renders the complete application tree without throwing router context errors', () => {
    expect(() => {
      render(
        <AppProviders>
          <App />
        </AppProviders>,
      );
    }).not.toThrow();

    expect(screen.getAllByText('Devventory')[0]).toBeVisible();
  });
});
