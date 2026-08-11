# Environment Tracker + Validation Integration Checklist

- [x] Add failing frontend tests for tabs, rule form lifecycle, cell severity,
      neutral selection, Add Rule, and invalidation.
- [x] Add failing Rust tests for rule-only union, disabled rules, search, and
      pagination.
- [x] Add bounded backend validation matrix projection contracts.
- [x] Compose active rule keys with the structural matrix server page.
- [x] Add matrix validation DTOs and frontend schemas.
- [x] Integrate validation severity borders in Compare and Inspect.
- [x] Extend the selected-key inspector with rule and issue details.
- [x] Replace Inspect's all-pages fetch with server pagination scoped to one
      environment.
- [x] Add route-backed Environment / Rules & Health / Issues tabs.
- [x] Reuse one validation rule modal from both Add Rule entry points.
- [x] Fix edit/create rule form reset and dirty-state behavior.
- [x] Add bounded Rules & Health and Issues tab workspaces.
- [x] Redirect `/validation` and remove its separate navigation item.
- [x] Run focused tests and repair regressions.
- [x] Run all frontend and Rust gates with long waits; record unrelated stale
      full-suite E2E selectors separately.
- [x] Perform final layout, accessibility, performance, and scope review.
