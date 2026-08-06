# Modal backdrop fix

## Root cause

The shared `DevventoryDialog` wrapper used the HeroUI v3 modal compound components with the wrong hierarchy:

- controlled `isOpen` and `onOpenChange` props were passed to `Modal` instead of `Modal.Backdrop`;
- `Modal.Container` was rendered as a sibling of `Modal.Backdrop` instead of as its child.

This allowed the backdrop to render above the dialog and prevented the overlay lifecycle from cleaning up reliably.

## Fix

- keep `Modal` as the root;
- move controlled state to `Modal.Backdrop`;
- nest `Modal.Container` and `Modal.Dialog` inside the backdrop;
- retain the existing dialog sizing, scrolling, and visual tokens.

## Regression coverage

- unit test verifies the dialog is nested within the backdrop and the backdrop is removed after close;
- Playwright test verifies a real Environment Tracker form is visible, closes cleanly, and can be opened again without an invisible overlay intercepting the app.
