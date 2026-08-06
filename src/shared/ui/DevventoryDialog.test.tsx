import { Button } from '@heroui/react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DevventoryDialog } from './DevventoryDialog';

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaceClicks, setWorkspaceClicks] = useState(0);

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Open dialog</Button>
      <Button onPress={() => setWorkspaceClicks((count) => count + 1)}>
        Workspace action
      </Button>
      <output aria-label="Workspace clicks">{workspaceClicks}</output>

      <DevventoryDialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <button type="button" onClick={() => setIsOpen(false)}>
          Close dialog
        </button>
      </DevventoryDialog>
    </>
  );
}

describe('DevventoryDialog', () => {
  it('keeps the dialog above its backdrop and removes the overlay after close', async () => {
    const user = userEvent.setup();

    renderWithProviders(<DialogHarness />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const dialog = await screen.findByRole('dialog');
    const backdrop = document.querySelector('.modal__backdrop');

    expect(backdrop).not.toBeNull();
    expect(backdrop).toContainElement(dialog);

    await user.click(
      within(dialog).getByRole('button', { name: 'Close dialog' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.querySelector('.modal__backdrop')).toBeNull();
    });

    await user.click(
      screen.getByRole('button', { name: 'Workspace action' }),
    );

    expect(screen.getByLabelText('Workspace clicks')).toHaveTextContent('1');
  });
});
