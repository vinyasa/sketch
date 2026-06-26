# Luceysketch Manual Smoke Tests

This checklist is intended to be run before and after significant changes to confirm that the core user workflows still behave correctly.

It is a lightweight regression pass, not a full QA plan. The focus is on the app's most important workflows:

- startup and basic UI
- board creation and editing
- assembly generation
- materials and viewport settings
- outliner and selection behavior
- cut list generation
- save/load/export paths
- undo/redo

---

## 1. Test Scope and Guidelines

### When to run this

Run this checklist:

- before starting a risky refactor
- after any store, viewport, persistence, builder, or tool changes
- before release candidates

### Recommended environment to record

For each run, note:

- app version from `src/version.json` or Settings panel
- operating system
- browser
- whether running dev server or production build
- date/time

### Pass criteria

A smoke run passes if:

- no blank screen or fatal crash occurs
- the listed workflows complete successfully
- no obvious regressions appear in selection, viewport rendering, or persistence
- console errors are absent or unchanged from known baseline

---

## 2. Suggested Test Session Setup

Start with a clean workspace if possible.

Recommended preparation:

1. Launch the app.
2. If an old autosave interferes with testing, use a fresh workspace or clear local cache from Settings.
3. Keep browser devtools open to watch for runtime errors.

---

## 3. Smoke Test Checklist

---

## A. App startup and shell

### A1. App loads successfully

**Steps**
1. Start the app.
2. Wait for the initial workspace to appear.

**Expected**
- the app renders without a blank screen
- header is visible
- 3D viewport is visible
- no fatal error overlay appears
- no immediate console crash is present

---

### A2. Header controls render and respond

**Steps**
1. Confirm the header shows the File menu and primary buttons.
2. Toggle the nav drawer open/closed if visible.

**Expected**
- header controls are visible and clickable
- drawer toggle works
- no layout corruption occurs

---

## B. New project / workspace reset

### B1. New Project flow works

**Steps**
1. Open `File`.
2. Click `New Project`.
3. Choose `Discard (Clear Workspace)`.

**Expected**
- workspace clears successfully
- prior boards/assemblies are removed
- viewport remains interactive
- app does not crash

---

## C. Add a custom board

### C1. Add a Custom Board from Components

**Steps**
1. Open `🔷 Components`.
2. Open the `Custom Board` flow.
3. Create a board with a recognizable name and simple size, such as:
   - Name: `Smoke Board`
   - Length: `12`
   - Width: `8`
   - Thickness: `0.75`
4. Confirm creation.

**Expected**
- new board appears in the viewport
- new board appears in the outliner
- new board becomes selected
- inspector can show the board

---

### C2. Add dimensional lumber and sheet goods

**Steps**
1. In `🔷 Components`, create one dimensional lumber part.
2. Create one plywood or sheet-goods part.

**Expected**
- both parts spawn successfully
- both appear in viewport and outliner
- no obvious orientation or scale bug is visible

---

## D. Selection and inspector editing

### D1. Viewport selection works

**Steps**
1. Click a board in the viewport.
2. Click empty space in the viewport.
3. Select the board again.

**Expected**
- board becomes selected when clicked
- selection clears on empty-space click
- inspector updates with the selected item

---

### D2. Outliner selection works

**Steps**
1. Open `🗂️ Outliner`.
2. Select a board from the outliner.
3. If multiple boards exist, shift-click or multi-select where supported.

**Expected**
- selection state matches the clicked item(s)
- selected item is highlighted
- inspector reflects current selection mode

---

### D3. Edit board dimensions and position

**Steps**
1. Select a board.
2. In the inspector, change one dimension.
3. Change one position value.
4. If available, use `Set on Floor`.

**Expected**
- board updates visually in the viewport
- dimensions update without corruption
- position change moves the board as expected
- no NaN/infinite values appear

---

### D4. Undo and redo work for basic edits

**Steps**
1. Modify a board dimension or position.
2. Click `Undo`.
3. Click `Redo`.

**Expected**
- undo restores the prior state
- redo reapplies the change
- history count updates sensibly

---

## E. Builders / procedural assemblies

### E1. Open Builders panel

**Steps**
1. Open `🧱 Builders`.
2. Verify the list of available builders is visible.

**Expected**
- panel opens successfully
- builder cards/buttons render
- no console error occurs on open

---

### E2. Build a cabinet

**Steps**
1. Launch the `Cabinet` builder.
2. Use default values or small test values.
3. Confirm build.

**Expected**
- a cabinet assembly is created
- multiple child boards appear
- cabinet appears in viewport
- cabinet appears in outliner under a group/assembly

---

### E3. Build one additional assembly type

**Steps**
1. Create one more assembly, such as:
   - Box
   - Door
   - Shelving
   - Table Base
2. Confirm creation.

**Expected**
- assembly is generated successfully
- generated boards are visible and selectable
- no builder dialog crash occurs

---

## F. Outliner and assembly organization

### F1. Create and use an assembly in the outliner

**Steps**
1. Open `🗂️ Outliner`.
2. Click `+ Assembly`.
3. Rename if supported.
4. Drag one board under the assembly if drag-drop is available.

**Expected**
- new assembly appears
- hierarchy updates correctly
- moved board remains visible/selectable

---

### F2. Expand/collapse and visibility toggles

**Steps**
1. Expand and collapse an assembly.
2. Toggle visibility on a board.
3. Toggle visibility on an assembly.

**Expected**
- expand/collapse works
- hidden items disappear from viewport
- child visibility follows parent visibility behavior
- restoring visibility works cleanly

---

## G. Materials and visual settings

### G1. Apply a wood material

**Steps**
1. Select a board.
2. Open `🎨 Materials`.
3. Apply a wood species such as walnut or cherry.

**Expected**
- selected board material updates visually
- no unrelated board changes unexpectedly

---

### G2. Apply a paint color

**Steps**
1. Keep a board selected.
2. In `🎨 Materials`, switch to Paint.
3. Apply a preset or custom color.

**Expected**
- selected board color updates
- color preview remains stable after selection changes

---

### G3. Toggle major viewport settings

**Steps**
1. Open `⚙️ Settings`.
2. Toggle these settings one at a time:
   - measurement system
   - show dimensions
   - show bounding box
   - collision warnings
   - dark mode
   - workspace layout
3. Also toggle from the header:
   - Grid
   - Dims
   - Perspective / Parallel

**Expected**
- toggles take effect immediately
- viewport remains responsive
- orthographic/perspective switch works
- theme switch does not break layout

---

## H. Tools / geometry operations

### H1. Open Tools panel with a selected board

**Steps**
1. Select one board.
2. Open `🧰 Tools`.

**Expected**
- panel opens
- single-board tools appear
- no selection-state crash occurs

---

### H2. Add one board operation

**Steps**
1. With one board selected, add one simple operation if available, such as:
   - hole
   - cove
   - arc
2. Apply or commit the operation.

**Expected**
- operation is stored and/or rendered correctly
- viewport remains stable
- inspector/tools remain usable afterward

---

### H3. Two-board interaction mode

**Steps**
1. Position two boards so they touch or overlap.
2. Select both.
3. Open `🧰 Tools`.

**Expected**
- contextual two-board tool UI appears when appropriate
- app does not crash when selection mode changes

---

## I. Collision warning behavior

### I1. Overlap detection

**Steps**
1. Create two boards occupying the same space.
2. Wait briefly for overlap detection.

**Expected**
- overlap warning badge appears
- overlapping boards are flagged consistently

---

### I2. Disable collision warnings

**Steps**
1. Open `⚙️ Settings`.
2. Disable `Collision Warnings`.

**Expected**
- overlap badge clears or stops updating
- no stale warning remains after disabling

---

## J. Cut list and plywood layout

### J1. Open cut list

**Steps**
1. Open `📋 Cut List`.
2. Review generated entries.

**Expected**
- panel opens successfully
- created boards appear in the list
- dimensions/material labels are plausible

---

### J2. Verify grouped and plywood modes

**Steps**
1. In the cut list, switch between available modes such as:
   - detail
   - grouped
   - plywood
2. If plywood parts exist, inspect sheet layout output.

**Expected**
- mode switching works
- grouped counts are plausible
- plywood mode renders layouts without crashing

---

## K. Save, load, import, export

### K1. Local save and reopen

**Steps**
1. Create a small workspace with at least 2–3 parts.
2. Open `File` → `Save`.
3. Reload the app or reopen the saved local file if supported.

**Expected**
- saved project can be reopened
- boards, assemblies, and basic settings persist

---

### K2. Disk export/import JSON

**Steps**
1. Open `File` → `Save...` to export a workspace JSON.
2. Start a new project.
3. Open `File` → `Open...` and import the exported JSON.

**Expected**
- export succeeds
- import succeeds
- reloaded project matches the original closely enough for smoke testing

---

### K3. GLB export

**Steps**
1. Open `File` → `Export 3D Model (.glb)`.

**Expected**
- export completes without crash
- a file is downloaded or save dialog appears

---

### K4. Print View opens

**Steps**
1. Open `File` → `Print View...`.

**Expected**
- print dialog/view opens
- no fatal rendering error occurs

---

## L. AI command path

### L1. Open AI panel if available in current build/workflow

**Steps**
1. Open the AI-related panel or workflow if exposed.
2. Confirm chat UI loads.

**Expected**
- panel opens
- input is interactive
- engine toggle renders if present

---

### L2. Simple command test

**Steps**
1. Select one board.
2. Submit a simple instruction, for example:
   - `Move the selected board up 1 inch`
   - `Make the selected board walnut`

**Expected**
- command completes or returns a clear error
- successful commands change only the intended target
- failed commands do not corrupt workspace state

> If AI setup is not configured in the current environment, record this as **Not Run / Environment Dependent** rather than a failure.

---

## 4. Optional Extended Checks

Run these when working on related systems:

- measurement tool interaction
- animation panel behavior
- hardware placement
- assembly library save/load
- user manual dialog
- welcome dialog
- local cache wipe flow in Settings

---

## 5. Test Run Template

Use this template to log a run.

```md
Date:
Tester:
Environment:
Version:
Browser:

Summary:
- Passed:
- Failed:
- Not Run:

Notes:
- 
- 
```

---

## 6. Minimum Quick Smoke Subset

If you only have 5–10 minutes, run this reduced set:

1. App loads
2. New Project works
3. Add Custom Board works
4. Select board and edit one dimension
5. Build Cabinet works
6. Apply one material
7. Open Cut List
8. Save and reload or export/import JSON
9. Undo/Redo one edit

If any of those fail, stop and investigate before continuing with larger changes.
