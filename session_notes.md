# Session Notes — April 13, 2026

## Summary
Long and productive session covering a wide range of UI/UX polish, bug fixes, and new features.

---

## Bugs Fixed

### Critical: Local Save Broken
- **File:** `src/store/actions.js` — `saveWorkspace()`
- `recentColors` was used in the payload but missing from the `get()` destructure
- Caused a silent `ReferenceError` that killed the save before `localStorage.setItem` ever ran
- **Fix:** Added `recentColors` to the destructured variables

### Cut List Black Screen Crash
- **File:** `src/components/panels/CutListPanel.jsx`
- `b.material.replace('-', ' ')` was called when `b.material` is now a descriptor object `{ type, id/hex }`
- Caused a `TypeError` that crashed the entire React tree
- **Fix:** Replaced with `matLabel()` helper using `normalizeMaterial()`

### Duplicate Code in materialCatalogue.js
- `PAINT_PALETTE` and old `_buildWoodSvg` were duplicated — old one was being used for `WOOD_TEXTURE_URLS`
- **Fix:** Removed the duplicate section; new two-layer turbulence builder is now the only one

### Thumbnail Broken (Hourglass Showing)
- **File:** `src/utils/assemblyThumbnail.js`
- AABB `let minX/maxX...` declarations were removed when the camera section was rewritten
- Variables were being referenced but never declared → crash → placeholder shown
- **Fix:** Restored the AABB accumulation loop

---

## New Features

### Cut List — Grouped Mode
- **File:** `src/components/panels/CutListPanel.jsx`
- Added **Detail / Grouped** toggle at top of panel
- Grouped mode aggregates pieces with identical material + all 3 dimensions
- Shows: `2× | Cherry | 12" × 1.5" × 1.5" | Leg A, Leg B`
- Sorted by material name then longest dimension

### AI Command: "Build a Cube"
- **File:** `src/store/actions.js` — `processAiCommand()`
- Triggers: `build a cube`, `create a cube`, `make a cube`
- Generates 6 panels, each 12×12×0.75", outer extent exactly 12" in all axes
- Three panels overlap at every corner (Miter state)

### Joint Toggle — Geometry-Aware
- **File:** `src/components/panels/InspectorPanel.jsx`
- Auto-detects "Miter" by checking AABB overlap with sibling boards
- Clicking now actually resizes boards:
  - **Miter → Butt 1:** Selected board stays full; all overlapping neighbours trimmed along selected board's thin axis
  - **Butt 1 → Butt 2:** Neighbours restored to full; selected board trimmed from all directions where neighbours are adjacent
  - **Butt 2 → Miter:** Selected board extended back to full overlap state
- Each state has its own color: Miter=purple, Butt 1=amber, Butt 2=steel blue

---

## UI Polish

### Header Bar Compacted
- **File:** `src/App.css`, `src/components/layout/AppHeader.jsx`
- All top-nav buttons (panel toggles, Dims, Hide Panels): `0.9rem → 0.72rem`, padding `8px 16px → 5px 10px`
- File menu + Undo/Redo: `0.85rem → 0.72rem`
- ↺ Undo / ↻ Redo icons added
- 📋 Cut List, ⚙️ Settings icons added (matching 📦 Library, 💡 Lighting, 🎨 Materials)
- All right-justified via existing `justify-content: space-between` on header

### Outliner Compacted
- **Files:** `src/App.css`, `src/components/panels/OutlinerPanel.jsx`
- Font: `0.75rem → 0.7rem`, row padding `4px 6px → 3px 5px`, gap `2px → 1px`
- Child indent: `16px → 12px` (CSS) + `12px → 10px` (JSX)
- Button area margin-top: `24px → 14px`
- "New Board" / "Assembly" buttons: explicit `0.7rem`, `4px 8px`

### Inspector Auto-Clamp on Expand
- **File:** `src/components/layout/DraggablePanel.jsx`
- Added `ResizeObserver` alongside the existing `window.resize` listener
- When the inspector expands after selecting a component, if the bottom edge clips below the viewport, the panel slides back up automatically

### Thumbnail Camera Fix
- **File:** `src/utils/assemblyThumbnail.js`
- Replaced `span * 1.8` heuristic with proper bounding-sphere + FOV math
- `sphereRadius = half the AABB 3D diagonal` (worst-case extent)
- `dist = sphereRadius / tan(halfFov) * 1.2` (20% padding)
- Fixes cube thumbnails being too large; correct for any shape

---

## AI Vocabulary (Documented)
The AI parser (`processAiCommand`) understands:
- **Materials:** walnut, pine, cherry, oak, red-oak, white-oak
- **Move/Nudge:** left/right/up/down/forward/back + red/green/blue + x/y/z
- **Resize:** cut/add/trim/extend/wider/thicker/longer etc. + dimension words
- **Add:** leg, top
- **Build:** box (+ from bounding box), cube (new)

---

## Known Gaps / Next Session Ideas
- AI doesn't understand: rename, clone/duplicate, delete, absolute positioning, newer wood species, paint colors
- Joint geometry works for symmetric box/cube — may need testing on asymmetric assemblies
- Save → Load cycle should be tested end-to-end now that save bug is fixed
- Consider: joint type per-edge rather than per-panel (complex; deferred)
