You are working on the Devventory desktop application.

Repository:
kuyajp123/devventory

Current working branch:
fix/my-branch

This prompt defines the MASTER SCOPE and TARGET ARCHITECTURE for a multi-phase implementation involving:

- Global application Settings
- Agent Usage reminder delivery
- In-app notifications
- Native/system notifications
- Background execution
- Windows startup
- System tray
- Single-instance behavior
- Devventory Quick Access secondary window
- Notification navigation and unread-state integration
- Development-only diagnostics

IMPORTANT:

This is the overall implementation specification and roadmap.

DO NOT implement the entire feature set from this prompt in one pass.

We will implement it phase-by-phase using separate detailed prompts.

For now:
1. Inspect the existing implementation and architecture.
2. Understand this specification.
3. Identify relevant existing modules, Rust/Tauri infrastructure, database models, frontend stores, routing, and notification/reminder code.
4. Treat the decisions below as the product requirements that later phases must remain compatible with.
5. Do not make code changes unless a later phase prompt explicitly instructs you to implement that phase.
6. Do not commit, push, create a PR, deploy, or release anything.

Use official primary documentation, especially current Tauri v2 documentation, whenever native APIs/plugins are involved.

Do not assume APIs from memory if they may have changed.

==================================================
OVERALL PRODUCT GOAL
==================================================

Devventory currently has Agent Usage reset reminders shown through in-app toasts.

Expand this into a proper desktop notification/background system while preserving Agent Usage as the source of truth.

The implementation should eventually support:

- globally configurable notification delivery
- native Windows notifications
- reliable reminder processing while Devventory is running in the background
- system tray behavior
- startup with Windows
- single-instance enforcement
- a floating "Devventory Quick Access" mini window
- targeted navigation from notifications into Agent Usage
- session-only unread indicators in Quick Access/tray

Do NOT implement a persistent generic Notification module/history in this project phase.

Agent Usage is currently the only notification-producing feature, so a generic notification inbox would duplicate information already available in Agent Usage.

Notifications are delivery mechanisms, not a second source of Agent Usage state.

==================================================
CORE ARCHITECTURAL PRINCIPLES
==================================================

Preserve the existing Devventory architecture and developer-workbench visual direction.

Before implementing any phase:

- inspect the existing implementation first
- reuse existing abstractions where appropriate
- preserve feature-based architecture and file colocation
- avoid duplicated helpers/services/components
- keep frontend, persistence, native integration, and business rules separated
- use typed boundaries between React and Tauri
- avoid placing critical background behavior exclusively inside React components if that makes it unreliable when webviews are hidden
- keep SQLite/app settings as the durable preference source rather than localStorage
- avoid introducing unrelated refactors

Native/background behavior must be robust when the main application window is hidden.

There must ultimately be exactly one authoritative reminder/background owner so that multiple windows do not independently poll reminders and cause duplicate delivery.

==================================================
PHASE ROADMAP
==================================================

The implementation will be split into six feature phases plus one final integration audit.

--------------------------------------------------
PHASE 1 — SETTINGS FOUNDATION
--------------------------------------------------

Create the global Settings foundation that later phases depend on.

Target Settings structure:

Settings
├── Notifications
└── Background & Startup

Do NOT add a Quick Access Settings section yet.

Settings should use a VS Code-like layout:

- left section navigation
- right settings content
- compact developer-workbench styling
- settings auto-save immediately
- no Save button

Suggested routes:

/settings/notifications
/settings/background-startup

Settings should be globally available and independent of the active project.

Notification settings:

Notifications                    ON by default
In-app notifications             ON by default
System notifications             OFF by default

"Notifications" is the master setting.

Master behavior:

- turning master OFF does NOT overwrite child values
- child toggles remain visually showing their stored values
- child controls become disabled/ineffective while master is OFF
- turning master back ON restores the previous child selections

Allow both child methods to be OFF while master remains ON.

When both are OFF, show a warning such as:

"No notification delivery method is enabled."

Do not automatically turn master OFF.

Background & Startup settings:

Keep Devventory running when closed    ON by default
Start Devventory with Windows          OFF by default

Persist these settings durably.

On persistence/native-setting failure:

- revert UI to the previous valid state
- show an appropriate error

Agent Usage quota dialog changes:

Rename:

"In-app reminders"

to:

"Reminders"

Reminder checkboxes continue to define WHEN reminders are scheduled, not HOW they are delivered.

Add subtle helper/link:

"Notification delivery is configured globally.
Notification settings →"

This should deep-link directly to:

/settings/notifications

If the quota dialog has unsaved changes:

show confirmation before leaving:

"You have unsaved quota changes.
Leave without saving?"

[Stay] [Leave]

Dirty state should represent the entire quota form, not only reminder controls.

Diagnostics:

Diagnostics remains functionally unchanged unless required for later notification testing.

However, Diagnostics must become development-only.

Use an explicit code configuration plus a hard production guard.

Conceptually:

DEVELOPMENT_FEATURES = {
  diagnostics: true,
}

DIAGNOSTICS_ENABLED =
  import.meta.env.DEV &&
  DEVELOPMENT_FEATURES.diagnostics

Production must never render the Diagnostics navigation item or route.

Typing /diagnostics in a production build must not expose the page.

Do not require an .env file for this flag.

--------------------------------------------------
PHASE 2 — REMINDER DELIVERY LIFECYCLE
--------------------------------------------------

Redesign the Agent Usage reminder consumption lifecycle before connecting native notifications.

Current "fetch due reminders and immediately mark delivered" behavior is not sufficient.

New rule:

A reminder has a 5-minute delivery grace period.

Example:

scheduled at 10:00

10:00–10:05
→ still eligible for delivery

after 10:05
→ stale
→ permanently skip/consume
→ never replay

Stale reminders must NOT:

- show an in-app toast
- show a System notification
- create Mini View unread state
- create tray unread state
- enter any generic notification history

There is no generic notification history in this implementation.

If Devventory was not running when the reminder was due:

do not catch it up later once the 5-minute grace has expired.

If notifications were intentionally disabled when the reminder was due:

consume/skip that reminder.

Do not replay it after the user later enables notifications.

Technical delivery failure is different.

Desired lifecycle:

due reminder
    ↓
older than 5 minutes?
    ├─ yes → mark/consume as skipped
    └─ no
         ↓
is delivery intentionally suppressed by preferences/context?
    ├─ yes → consume as skipped
    └─ no
         ↓
attempt delivery
         ├─ success → acknowledge delivered
         └─ technical failure
                ↓
retry while still within 5-minute grace
                ↓
grace expires → consume as skipped

"delivered_at" should mean successful dispatch, not merely fetched from the database.

If the existing schema cannot represent this safely, design a better claim/ack/skip lifecycle.

Prevent duplicates across:

- repeated 60-second polling
- concurrent delivery attempts
- application windows
- restarts
- temporary failures

The existing frontend session Set must not be the authoritative deduplication mechanism.

Review whether background polling should remain frontend-driven.

Because the main and Quick Access windows can both be hidden, prefer an app-level background architecture that remains reliable while webviews are not visible.

Do not assume browser/webview timers are sufficient without validating the behavior.

--------------------------------------------------
PHASE 3 — NOTIFICATION SYSTEM
--------------------------------------------------

Build the notification delivery layer on top of the reliable lifecycle.

Recommended conceptual separation:

notificationDispatcher
    ├── inAppNotificationService
    └── systemNotificationService

Use the official Tauri v2 notification integration for native/system notifications.

Do NOT substitute the browser Web Notification API unless there is a documented architectural reason.

Terminology:

Use:

"System notifications"

not "Windows notifications" in the UI.

Helper copy may mention Windows Notification Center where appropriate.

System notification behavior:

- default OFF
- first enable checks OS permission
- if permission is undecided, request permission
- if denied, keep setting OFF
- explain that system notifications are disabled by Windows/settings
- do not repeatedly request permission after denial

If the user later revokes OS notification permission externally while Devventory's stored System setting is ON:

- detect/reconcile the state
- persist System notifications as OFF
- leave master and In-app preferences untouched
- show appropriate helper text

No custom notification sound setting for now.

Use the normal/default Windows notification behavior.

System notification content may include the account identifier/email.

Example:

Title:
Devventory

Body:
Antigravity · john@example.com · Weekly — Reset time has been reached.

Keep IDs such as:

accountId
quotaWindowId

as metadata/state.

Never parse visible notification text to determine navigation.

--------------------------------------------------
NOTIFICATION DELIVERY ROUTING
--------------------------------------------------

Master OFF:

→ no notification delivery

Full Devventory main window focused:

If In-app ON:
→ show in-app toast

If In-app ON and System ON:
→ suppress duplicate System notification

If In-app OFF and System ON:
→ send System notification

Main Devventory hidden/background/minimized:

If System ON:
→ System notification

If System OFF:
→ no visible native notification

In-app notification alone does not show a toast while the full main app is not focused.

Quick Access is NOT a HeroUI toast surface.

When Quick Access is focused:

In-app ON:
→ represent the in-app notification using the Quick Access unread indicator

System ON:
→ System notification may also be delivered

Therefore:

Quick Access active
In-app ON
System OFF
→ Mini View indicator only

Quick Access active
In-app OFF
System ON
→ System notification only

Quick Access active
In-app ON
System ON
→ System notification + Mini View indicator

In-app OFF must mean:

- no Quick Access unread indicator
- no tray unread indicator

regardless of System notification preference.

--------------------------------------------------
IN-APP TOASTS
--------------------------------------------------

Agent Usage reminder toasts should be actionable.

Use an explicit duration of approximately 8 seconds.

Auto-dismiss:

→ does NOT acknowledge the reminder/unread state

User interaction:

→ acknowledges it

Single reminder toast should provide navigation such as:

View quota

Clicking it should:

- navigate to Agent Usage
- reveal the relevant platform/account
- reveal/highlight the quota window
- acknowledge the corresponding session unread state

--------------------------------------------------
BURST GROUPING
--------------------------------------------------

The existing reminder cycle is approximately 60 seconds.

Use the same due-reminder polling/delivery batch as the burst grouping boundary.

Do NOT add an artificial waiting/debounce delay to collect more reminders.

Rules:

1 deliverable reminder in a polling batch
→ individual notification

2 or more deliverable reminders in the same polling batch
→ one calm summary notification

This applies even if the reminders belong to only two accounts.

Avoid urgent language.

Example:

"2 Agent Usage reminders are ready.
Antigravity and Codex have quota updates."

Do NOT use language such as:

"needs attention"
"urgent"
"warning"

Burst counts should represent unique deliverable reminders and must not accidentally count duplicate database rows.

Clicking an individual notification:
→ targeted Agent Usage navigation

Clicking a burst:
→ general Agent Usage navigation
→ do not arbitrarily expand one account

--------------------------------------------------
DIAGNOSTIC NOTIFICATION TESTS
--------------------------------------------------

Diagnostics should eventually include two development-only tests:

1. Test normal notification

This must use the real notification dispatcher.

It respects:

- master preference
- In-app preference
- System preference
- current app/window context

It should be possible for Diagnostics to report that a channel was suppressed because of preference/context.

2. Test system channel directly

This tests the native System notification adapter directly.

It bypasses only Devventory's System-notification preference.

It does NOT bypass actual OS permission.

It must not create Agent Usage reminders or modify quota scheduling.

Both tests must use the same production notification services/adapters rather than fake testing implementations.

--------------------------------------------------
PHASE 4 — BACKGROUND, TRAY & STARTUP
--------------------------------------------------

Implement the native application lifecycle.

System tray:

The tray icon should always exist whenever the Devventory process is running.

There is NO:

"Show tray icon"

setting.

Fully quitting Devventory removes the tray icon.

Tray context menu should remain minimal:

Open Devventory
Open Quick Access
----------------
Quit Devventory

Do NOT add Settings to the tray menu.

Users can open Devventory and navigate to Settings normally.

--------------------------------------------------
KEEP RUNNING WHEN CLOSED
--------------------------------------------------

Setting:

Keep Devventory running when closed

Default:
ON

When ON:

Main window X
→ hide the full main window
→ process stays alive
→ tray stays alive
→ reminder monitoring continues

Do not show a confirmation or one-time explanation.

When OFF:

Main window X
→ fully terminate Devventory
→ close Quick Access
→ remove tray
→ stop reminder monitoring

Tray menu:

Quit Devventory

must ALWAYS fully terminate the application regardless of this setting.

Implement close interception carefully so explicit Quit cannot be accidentally converted into hide-to-tray behavior.

--------------------------------------------------
START WITH WINDOWS
--------------------------------------------------

Setting:

Start Devventory with Windows

Default:
OFF

Use the current official Tauri solution/plugin where appropriate.

OFF:

→ Devventory does not launch at login

ON:

→ Devventory launches silently/background at Windows login
→ full main window starts hidden
→ Quick Access starts hidden
→ tray becomes available
→ reminder monitoring starts

If enabling/disabling OS autostart fails:

- restore the previous UI setting
- avoid leaving persisted preference inconsistent with actual OS registration

Reconcile actual OS state where practical.

--------------------------------------------------
SINGLE INSTANCE
--------------------------------------------------

Devventory must become a single-instance application.

If Devventory is already running and the user launches it again:

- do NOT start a second background runtime
- do NOT create another tray icon
- do NOT create another reminder poller
- hide Quick Access if visible
- show/restore/focus the existing full Devventory window

This is important for avoiding duplicate notifications and SQLite contention.

--------------------------------------------------
PHASE 5 — DEVVENTORY QUICK ACCESS
--------------------------------------------------

Create a real secondary Tauri WebviewWindow.

This is NOT resizing the main Devventory window.

Suggested label:

quick-panel

Window title:

Devventory Quick Access

It shares the same Devventory process/backend/database.

It must not become a second independent app/runtime.

Be careful not to mount duplicate global reminder polling simply because another React webview exists.

--------------------------------------------------
QUICK ACCESS VISUAL BEHAVIOR
--------------------------------------------------

Use the existing Devventory developer-workbench visual direction.

Custom frameless compact title bar:

Devventory Quick Access        ↗   ×

Header/title bar acts as the drag region.

×
→ hide Quick Access
→ do NOT quit Devventory

↗
→ hide Quick Access
→ show/focus full Devventory

Mini View requirements:

- always-on-top while visible
- always-on-top is core behavior, not a setting
- non-resizable by the user
- controlled compact width
- content-aware/programmatic height allowed
- frameless/custom title bar
- skip normal taskbar presence
- tray-launched utility-window behavior
- full Devventory remains the normal Windows taskbar application
- no global Quick Access keyboard shortcut yet

Global shortcut support is explicitly deferred to a later implementation.

--------------------------------------------------
QUICK ACCESS DEFAULT POSITION
--------------------------------------------------

Default:

bottom-right corner of the usable monitor area

Position above the Windows taskbar.

Do not overlap the taskbar.

Handle multi-monitor work areas safely.

When possible, use the monitor appropriate to the tray/current window context rather than blindly forcing the primary display.

Position memory:

First Quick Access open after app startup:
→ bottom-right

If the user drags Quick Access:
→ remember position for the current Devventory session

Hide/reopen:
→ reopen at the user's last session position

Fully quit/relaunch:
→ forget custom position
→ start bottom-right again

Do NOT persist coordinates to SQLite/settings yet.

--------------------------------------------------
QUICK ACCESS PLACEHOLDER UI
--------------------------------------------------

For this implementation, Quick Access functionality itself does NOT need to add data yet.

Show future quick-action UI such as:

QUICK ACTIONS

+ Environment Key
  Add a custom environment key
  Coming soon

+ Quota Window
  Add an Agent Usage quota window
  Coming soon

Do not implement the forms yet.

Prefer clearly communicating "Coming soon" rather than making buttons appear functional and silently doing nothing.

The purpose of this phase is to establish the real Quick Access window/lifecycle architecture.

--------------------------------------------------
TRAY INTERACTIONS
--------------------------------------------------

Tray single-click:

→ toggle Devventory Quick Access

Tray double-click:

→ hide Quick Access
→ show/focus full Devventory

Implement this carefully because some platforms may emit single-click events as part of a double-click sequence.

Use appropriate delay/debouncing/event handling so double-clicking does not visibly flash Quick Access before opening the main app.

Tray menu:

Open Devventory
→ hide Quick Access
→ show/focus main window

Open Quick Access
→ show/focus Quick Access

Quit Devventory
→ terminate entire process

--------------------------------------------------
MAIN WINDOW + QUICK ACCESS INTERACTION
--------------------------------------------------

If Keep Devventory running when closed = ON:

Main window X
→ hide main
→ if Quick Access was already visible, allow it to remain visible

If Keep Devventory running when closed = OFF:

Main window X
→ terminate app
→ Quick Access closes too

When a user explicitly opens the full Devventory app through:

- Quick Access ↗
- tray double click
- tray "Open Devventory"
- second application launch
- notification navigation

hide Quick Access and focus the full app.

--------------------------------------------------
QUICK ACCESS AUTO-HIDE
--------------------------------------------------

Long-term architecture should support:

Quick Access home / no protected unsaved state:
→ clicking/focusing outside may auto-hide

Active form with unsaved input:
→ do NOT auto-hide on focus loss
→ user must cancel/close/complete

Although Environment Key / Quota forms are UI-only for this implementation, structure the Quick Access lifecycle so future forms can explicitly register protected/dirty state.

Do not infer unsaved form state from DOM heuristics.

--------------------------------------------------
PHASE 6 — NOTIFICATION + QUICK ACCESS INTEGRATION
--------------------------------------------------

Integrate notification session state with Quick Access and tray.

There is NO persistent generic Notifications module/history.

Unread notification state exists only for the current running Devventory session.

--------------------------------------------------
MINI VIEW INDICATOR
--------------------------------------------------

When:

Master Notifications ON
AND
In-app notifications ON

Agent Usage reminders may create Mini View/tray unread state.

If In-app notifications are OFF:

there must be:

- no Mini View blinking/unread indicator
- no tray unread state

even if System notifications are ON.

--------------------------------------------------
REMINDER ARRIVES WHILE QUICK ACCESS IS VISIBLE
--------------------------------------------------

Show a subtle notification indicator.

On newly arriving reminder:

→ pulse/blink subtly for approximately 5 seconds
→ then remain as a solid unread indicator

For a burst, optionally show a count such as:

bell 2
bell 5

Avoid aggressive flashing.

--------------------------------------------------
REMINDER ARRIVES WHILE QUICK ACCESS IS HIDDEN
--------------------------------------------------

Do NOT force-open Quick Access.

Store session unread state.

Tray shows a subtle unread state.

Do NOT blink the tray icon.

Tooltip may communicate something such as:

"Devventory — 2 unread reminders"

When the user later opens Quick Access:

→ show the solid unread indicator immediately

Do NOT start the 5-second pulse at that point because the notification is no longer newly arriving.

If Quick Access is hidden again without acknowledgement:

→ tray unread indication returns

If Quick Access is visible:

→ unread state is represented inside Quick Access instead of relying on the tray visual state

--------------------------------------------------
UNREAD STATE LIFETIME
--------------------------------------------------

Session-only.

Hide/reopen Quick Access:
→ preserve unread

Hide main app to tray:
→ preserve unread

Full Devventory Quit:
→ clear unread session state

Restart:
→ do not resurrect old unread indicators

No persistent notification inbox is being created.

--------------------------------------------------
ACKNOWLEDGEMENT RULES
--------------------------------------------------

A reminder is acknowledged only through intentional interaction.

Single reminder acknowledgement:

- click its System notification
- click its actionable in-app toast
- click its Quick Access notification indicator
- follow/open the targeted reminder in Agent Usage

Burst acknowledgement:

- click System summary notification
- click burst in-app action
- click Quick Access burst indicator

These actions should NOT acknowledge:

- merely opening Quick Access
- single-clicking the tray
- opening Devventory normally
- navigating to an unrelated module
- toast auto-dismiss

--------------------------------------------------
TARGETED NOTIFICATION NAVIGATION
--------------------------------------------------

Single reminder:

→ hide Quick Access if visible
→ show/focus full Devventory
→ navigate to /agent-usage
→ reveal relevant platform
→ reveal relevant account
→ reveal relevant quota window
→ briefly highlight the quota

Burst:

→ hide Quick Access
→ show/focus full Devventory
→ navigate to general Agent Usage
→ do not select an arbitrary account

Use IDs carried in notification state/metadata.

Do not parse text strings.

--------------------------------------------------
DELETED TARGET FALLBACK
--------------------------------------------------

If the notification's original quota still exists:

→ reveal/highlight normally

If quota has been deleted but account still exists:

→ open Agent Usage
→ reveal account if practical
→ show non-destructive feedback such as:

"This quota window is no longer available."

If account also no longer exists:

→ open general Agent Usage
→ show:

"This notification target is no longer available."

Never route the user to a broken page/error screen.

--------------------------------------------------
STATUS EVENTS THAT MUST NOT CREATE NOTIFICATIONS
--------------------------------------------------

Notifications remain RESET-REMINDER based only.

Do NOT create notifications merely because a quota/account becomes:

- Exhausted
- Limited
- Unknown
- Available
- ResetSoon

Only configured reminder schedules should create delivery events:

- custom before-reset reminder
- reset day reminder
- reset time reached reminder

--------------------------------------------------
PHASE 7 — FINAL INTEGRATION AUDIT
--------------------------------------------------

After Phases 1–6 are implemented, perform a dedicated integration review.

Do NOT add new product features during this phase.

Review the entire feature as one lifecycle.

Pay special attention to:

- duplicate reminder delivery
- stale reminder handling
- 5-minute grace boundaries
- retry behavior
- claim/ack correctness
- process/window lifecycle races
- main window focus detection
- Quick Access visibility detection
- tray single vs double click
- single-instance launches
- close-to-tray vs explicit Quit
- Windows startup behavior
- notification permission denial
- permission externally revoked
- preference persistence failures
- burst grouping
- actionable toast navigation
- native notification navigation
- deleted target fallback
- unread indicator acknowledgement
- no unread resurrection after restart
- no duplicate reminder runtime between main and Quick Access webviews
- Diagnostics production gating
- production route safety

Use this phase to fix integration defects only.

==================================================
RECOMMENDED TEST MATRIX
==================================================

Each detailed phase prompt will define its own tests, but the final system should eventually verify scenarios including:

Settings:
- fresh-install defaults
- master OFF preserving child selections
- restoring child selections when master re-enabled
- both child channels OFF warning
- persistence failure rollback

Reminder lifecycle:
- exactly scheduled
- one minute late
- exactly around five-minute boundary
- older than five minutes
- intentional suppression
- temporary delivery failure
- retry success
- retry grace expiry
- repeated polling
- application restart
- concurrent claims

Notification routing:
- main focused + In-app ON
- main focused + System only
- background + System ON
- background + System OFF
- Mini visible + In-app only
- Mini visible + System only
- Mini visible + both
- master OFF

Burst:
- one reminder
- exactly two reminders
- several reminders
- mixed platforms/accounts
- duplicate DB rows do not inflate counts

Tray/background:
- X with keep-running ON
- X with keep-running OFF
- explicit Quit
- startup ON
- startup OFF
- second application launch
- tray single click
- tray double click

Quick Access:
- bottom-right placement
- work-area/taskbar avoidance
- multi-monitor handling
- always-on-top
- session position memory
- skip-taskbar
- hide/open full app
- main close while Quick Access visible

Unread:
- Mini visible at arrival
- Mini hidden at arrival
- hide/reopen
- acknowledgement paths
- toast timeout
- full Quit
- restart

Navigation:
- target exists
- quota deleted
- account deleted
- burst notification

Production safety:
- Diagnostics absent from navigation
- /diagnostics inaccessible
- no diagnostic-only IPC exposed unnecessarily

==================================================
VALIDATION EXPECTATIONS
==================================================

Use the repository's actual scripts after inspecting package.json/Cargo configuration.

Where applicable, expect verification similar to:

npm run typecheck
npm run test:unit
npm run lint
npm run build

cargo check
cargo clippy
cargo test

Do not blindly run unsupported scripts; inspect the repo first.

Native integration must eventually be tested using an installed/packaged Windows build as well as development mode.

Tauri/Windows behavior such as:

- notification application identity/icon
- tray behavior
- autostart
- single-instance behavior
- close lifecycle

may differ from `tauri dev`.

Do not consider native notification work fully verified based only on the web frontend or development server.

==================================================
SOURCE REQUIREMENTS
==================================================

For Tauri/native functionality, use current official primary documentation.

This includes, where applicable:

- Tauri v2 notification plugin
- tray APIs
- autostart plugin
- single-instance plugin/API
- WebviewWindow/window APIs
- close/window lifecycle APIs
- monitor/work-area positioning
- capability/permission configuration

Do not invent Tauri APIs.

If current official behavior conflicts with assumptions in this specification, preserve the intended user-facing behavior and explain the technical adjustment required.

==================================================
NON-GOALS FOR THIS IMPLEMENTATION
==================================================

Do NOT implement:

- generic persistent Notification module/history
- Quick Access settings section
- global Quick Access keyboard shortcut
- functional Add Environment Key Mini View form
- functional Add Quota Window Mini View form
- custom Devventory notification sounds
- status-transition notifications
- cloud push notifications
- OS scheduled notifications while Devventory is fully terminated
- unrelated UI redesigns
- unrelated architectural refactors

==================================================
FINAL EXPECTATION
==================================================

Treat this document as the product contract for the complete feature.

Implementation will happen through separate prompts in this order:

1. Settings Foundation
2. Reminder Delivery Lifecycle
3. Notification System
4. Background / Tray / Startup / Single Instance
5. Devventory Quick Access
6. Notification + Quick Access Integration
7. Final Integration Audit

Each future implementation prompt should:

- begin by inspecting the current implementation
- take previous completed phases into account
- implement only its defined phase
- preserve requirements from this master specification
- test its own scope
- avoid implementing future phases prematurely
- report what changed and any risks/deviations
- not commit, push, deploy, or release unless explicitly requested