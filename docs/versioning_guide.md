# Little Lucey Woodcraft: Versioning & Releases Guide

This document outlines the system and process for managing application versions and cutting new open-source releases on GitHub.

---

## ⚙️ Versioning Strategy (SemVer + CalVer)

The application uses a **hybrid SemVer-CalVer** versioning pattern with daily resolution:

$$\text{v[Major].[Minor].[YY].[MM].[DD]}$$

*   **`0.8` (Major.Minor)**: The core feature baseline. You control when to bump this (e.g., when introducing significant architectural shifts or major upgrades).
*   **`26.05.29` (YY.MM.DD)**: Calculated automatically using the calendar date of the release. This tells you and your users exactly when their build was created, enabling fast and precise bug support.

---

## 🚀 How to Cut a New Release

To release a new version, perform the following steps:

### Step 1: Run the Bumping Script
Navigate to the `apps/sketch` directory and run:
```bash
npm run bump
```
*(Or if you are at the monorepo root: `pnpm --filter sketch run bump`)*

This script will read `src/version.json`, calculate the current day's CalVer string, and show a prompt:
```text
⚙️  Current Version: 0.8.26.05.29
👉 Proposed Version: 0.8.26.05.29 (Keeping 0.8 baseline with current date 26.05.29)

Press [ENTER] to accept, or enter custom version (e.g. 0.9.26.05.29):
```

*   **To keep the current baseline**: Simply press **[ENTER]**.
*   **To upgrade the baseline**: Type the full new version string (e.g., `0.9.26.05.29`) and press **[ENTER]**.

### Step 2: Push Commits and Tags to GitHub
The script automatically updates `src/version.json`, stages it, creates a release commit, and adds an annotated Git tag locally. 

To push both the code changes and the release tag to GitHub, run:
```bash
git push origin main --tags
```

---

## 📂 System Architecture

The versioning system consists of four key parts:

1.  **Single Source of Truth**: [src/version.json](file:///d:/Antigravity%20Dev/BikerToddWeb/apps/sketch/src/version.json)
    Contains the version string and release timestamp.
2.  **Automation Script**: [scripts/bump.js](file:///d:/Antigravity%20Dev/BikerToddWeb/apps/sketch/scripts/bump.js)
    A Node script that handles date formatting, terminal prompts, and local git commands.
3.  **UI Integration**: [SettingsPanel.jsx](file:///d:/Antigravity%20Dev/BikerToddWeb/apps/sketch/src/components/panels/SettingsPanel.jsx)
    Imports `version.json` and renders the active version number in the footer card next to the Credits & License card.
4.  **CLI Registration**: Registered under `"scripts"` in `package.json` as `npm run bump`.
