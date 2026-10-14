# Development and installed Devventory profiles

## Why the profiles are separate

Running newer development code previously applied database migrations to the installed application's SQLite database. Installed Devventory 1.3.1 understands migrations through 15, while Cloud Sync and account ownership introduce migrations 16 and 17. The older executable therefore cannot start against that upgraded database.

Development now selects its own Tauri identifier **before application initialization**. SQLite, migration backups, encrypted Vault files, uploaded source icons, WebView data and the single-instance mutex resolve through the development identity. Native account and publishing credentials use matching, separate Windows Credential Manager services. Packaged builds retain their existing production identity and credential entries.

| Resource                     | Installed application                | Development application                  |
| ---------------------------- | ------------------------------------ | ---------------------------------------- |
| Tauri identifier             | `com.paul.devventory`                | `com.paul.devventory.dev`                |
| Windows data folder          | `%LOCALAPPDATA%\com.paul.devventory` | `%LOCALAPPDATA%\com.paul.devventory.dev` |
| Account credential service   | `com.paul.devventory.authentication` | `com.paul.devventory.dev.authentication` |
| Publisher credential service | `com.paul.devventory.cloud-sync`     | `com.paul.devventory.dev.cloud-sync`     |
| Autostart application name   | Existing packaged name               | `Devventory Development`                 |

The selection uses Tauri's development/custom-protocol mode, not the compiler's optimization level: `tauri dev --release` is still development, and a packaged debug build is still installed. No new CLI flag is needed. Window label, dimensions, minimum size, centering and resizable settings remain unchanged.

From the repository root:

```powershell
npm run tauri dev
```

New development profiles start with the normal empty database and optional sync disabled. Startup never automatically copies, replaces or restores the installed profile. An explicitly prepared development copy is a one-time snapshot; subsequent edits do not copy back to the installed database or Vault. Existing project filesystem roots can still point to the same working directories: profile isolation is not a filesystem sandbox.

## Current profile preservation

On 2026-10-14, the current schema-17 profile was preserved with a consistent SQLite online backup and copies of the encrypted Vault, salt, uploaded icons and existing migration backups. Disposable WebView cache and SQLite journal companions were not copied. The original profile was not restored to an older schema or cleared.

- Safety copy: `C:\Users\Paul\AppData\Local\Devventory-Recovery-20261014\current-profile-schema17`.
- Development copy: `C:\Users\Paul\AppData\Local\com.paul.devventory.dev`.
- Both copies passed SQLite `quick_check`; row counts matched across all 34 tables, including six projects, ten credential sources, 120 credentials, and their associations.
- Vault snapshot and salt copies matched the original byte-for-byte. No Vault password or decrypted value was requested or inspected.
- Only the development copy's cloud-sync enable flag and existing system-notification/Windows-autostart preferences were set off. Native account/publisher credentials were not exported or copied.

Keep the encrypted Vault file **and its salt together with the matching database**. The database contains references and associations; the encrypted Vault holds the values. A database-only backup is not a complete Vault backup. Unlocking the copied Vault still uses the same master password. Secret-value acceptance remains a user-entered check; matching encrypted files does not mean the assistant decrypted them.

## Cloud and updater boundaries

Local profiles are separate; the deployed Firebase project and Cloudflare Worker are not duplicated. Do not connect development to your production account or confirm replacement of its publishing desktop just to test authentication. Use a separate test account/workspace and synthetic data. Linking and first upload still require explicit approval; the prepared development copy keeps sync off.

The packaged application's existing updater public key and endpoint remain unchanged. Development profile isolation does not disable the updater plugin; do not use the development app to install production releases. Test installer/update flows using a deliberate packaged acceptance build.

## Local recovery installer

The user chose a newer compatible local build instead of restoring the October 13 schema-15 backup. The recovery build uses **1.3.2-recovery.1**, a prerelease above installed 1.3.1 but below a future public 1.3.2, so later stable updates remain eligible.

Its version and `bundle.createUpdaterArtifacts=false` are supplied through an external Tauri configuration overlay in the local recovery folder. Repository versions, production identifier, database migrations and updater trust configuration are unchanged. This creates a manually installed local NSIS package, **not** signed updater artifacts or a public release. No signing identity is rotated and no Git tag, commit, push or cloud deployment is part of recovery.

Do not reinstall 1.3.1 over the current database to fix startup, delete SQLx migration records, or restore an older database without reviewing what newer data would disappear. Use the compatible recovery installer with the unchanged schema-17 database and preserve the safety copy.

The local installer was built and installed successfully on 2026-10-14 using NSIS `/S /UPDATE` mode, which preserves application data. The installed executable and Windows installation registration both report `1.3.2-recovery.1`. It opened a responsive main window; post-startup checks retained schema 17, all six projects, ten credential sources, 120 credentials and their associations. Both encrypted Vault files still matched the safety snapshot byte-for-byte.

- Installer: `C:\Users\Paul\AppData\Local\Devventory-Recovery-20261014\Devventory_1.3.2-recovery.1_x64-setup.exe` (15,006,012 bytes).
- Installer SHA-256: `50406fe385eadd7219f43bbeabd1d1131648a6cfe6d5979d4ffcf11d1be3c06e`.
- The installed executable matches the compiled binary except for Tauri's expected bundle-type marker (`UNK` in the restored build output; `NSS` in the NSIS package). All other bytes match.
- Final user acceptance: unlock Credential Vault locally with the existing master password and confirm the expected credentials/values. Do not share the password or values. No secret decryption was performed as part of these checks.

Until the isolation change is committed and merged, run development from `codex/dev-environment-isolation`. An older checkout without this change still uses the installed profile.

## Verification

The isolation change passed all 167 Rust tests, including the Stronghold multiline-value/session-lock round trip. All five profile regression tests also passed with `tauri/custom-protocol` enabled, covering installed-build selection. Rust formatting, Clippy with warnings denied, `cargo check`, frontend lint, formatting, TypeScript and the production frontend build passed. The frontend build retains its existing large-chunk warning.

Dependency audits are not an all-clear: the unchanged npm dependency graph reports 20 findings (three moderate, sixteen high and one critical); Cargo reports no non-ignored vulnerabilities but retains existing advisory warnings. This recovery does not change dependencies or silently apply audit fixes.
