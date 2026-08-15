# Task Plan: Inline About & Updates Flow & Header Layout Reordering

- [ ] Task 1: Reorder header elements in `AppLayout.tsx` (placing `AppUpdateIndicator` to the left of Search input) and remove `AppUpdateModal`
- [ ] Task 2: Update `AppUpdateIndicator.tsx` to navigate to `/settings/about-updates` on click, and update `AppUpdateIndicator.test.tsx`
- [ ] Task 3: Enhance `AboutUpdatesSettingsSection.tsx` with inline update details (version cards, publication date, changelog/what's new, warning, direct "Update Now" action, download progress bar, installing/relaunching states, error/retry states)
- [ ] Task 4: Remove obsolete `AppUpdateModal.tsx` & `AppUpdateModal.test.tsx`, update `src/features/app-updater/index.ts`
- [ ] Task 5: Expand `AboutUpdatesSettingsSection.test.tsx` to test all inline states and direct update execution
- [ ] Task 6: Run all quality gates (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run build`)
