# Custom Release Notes Guide ("What's New" Updates)

This guide explains how to customize and publish human-friendly release notes that appear directly in Devventory's **"What's New"** section under **Settings ? About & Updates**.

---

## How "What's New" Works in Devventory

1. When a release is published, the release engine creates the version tag and publishes artifacts and release notes to the public releases repository ([`kuyajp123/devventory-releases`](https://github.com/kuyajp123/devventory-releases)).
2. Devventory's in-app updater checks `latest.json` and the GitHub Release endpoint.
3. The release description is passed directly to Devventory's **"What's New"** preview box in the update modal and *About & Updates* settings pane.

---

## Step-by-Step Workflow (Option B: Custom GitHub Release Notes)

### 1. Merge the Pull Request to `main`
- Merge your PR to `main` using your preferred method (e.g. **Squash and merge**).
- Give the squash commit a descriptive Conventional Commit title (e.g. `feat(vault): add inline secret reveal, direct copy, vault auto-centering, and fix asset metadata sync (#26)`).

---

### 2. Publish the Release
Publish the new release using either path:

- **Local Release (Maintainer Machine)**:
  ```powershell
  git checkout main
  git pull origin main
  npm run release:local
  ```
- **Hosted GitHub Actions Release**:
  - Automatically triggered on push/merge to `main` when configured.

---

### 3. Edit the Release on GitHub
1. Go to the public releases repository:
   **[https://github.com/kuyajp123/devventory-releases/releases](https://github.com/kuyajp123/devventory-releases/releases)**
2. Find the newly published release tag (e.g. `v0.2.0`).
3. Click the **?? Edit release** button in the top right.
4. In the release description editor, replace the automated commit bullet points with your rich, user-friendly changelog.
5. Click **Update release** (or **Save release**).

---

### 4. Verify in Devventory
1. Open Devventory on a previous version.
2. Navigate to **Settings ? About & Updates**.
3. Click **Check for updates**.
4. The **"What's New"** section will render your formatted Markdown, headings, and bullet points.

---

## Recommended Release Notes Template

Copy and adapt this template when editing releases on GitHub:

```markdown
## ?? What's New in v0.2.0

### ? Features & UX Improvements

- **Quick Secret Reveal & Copy in Environment Tracker**:
  - View and copy encrypted secret values directly from the Environment Tracker details pane for any environment variable linked from Credential Vault.
  - Secret values are masked with `••••••••••••` by default for privacy.
  - **One-Click Copy**: Click the **Copy** button to copy the decrypted secret straight to your clipboard without having to reveal the plaintext on screen.
  - **Inline Reveal / Hide**: Toggle secret visibility inline with automatic master password verification.
  - **Direct Vault Navigation**: Added an **"Open in Credential Vault"** shortcut that automatically navigates to and highlights the selected secret in the vault.

- **Auto-Scroll to Selected Vault Secrets**:
  - When redirecting to the Credential Vault from the Environment Tracker, the target credential row is now automatically centered smoothly in your view, even in sources with long lists of keys.

- **Cleaner Environment Matrix & Source Management**:
  - Unlinked vault credentials no longer appear in project environment tables until they are explicitly assigned to an environment.
  - Added support for removing vault-linked sources and custom definitions directly from Environment Settings with a confirmation dialog.

### ?? Bug Fixes

- **Asset Metadata Form Sync**:
  - Fixed an issue in the File Inventory right-hand inspector where existing tags, notes, and favorite status were not showing up in the **Edit asset metadata** dialog. All saved tags and notes now display properly when opened.

- **Locked Vault State Polish**:
  - Streamlined the locked state UX in the Environment Tracker details pane by preventing duplicate unlock prompts and cleanly showing protected masks when the vault is locked.
```
