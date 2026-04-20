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

---
---

# Session Notes — April 19, 2026

## Summary
Two features shipped: compound miter cuts and the cabinet builder. Also confirmed the rotation analysis cleanup (Phase 4) was fully completed in a prior session.

---

## Features Shipped

### Compound Miter Cuts (Bevel)
- **Files:** `Viewport3D.jsx`, `ToolsPanel.jsx`, `InspectorPanel.jsx`
- `_buildMiterTool` now supports a `bevel` parameter in addition to the existing miter `angle`
- **Miter** = turntable swing (rotation around Y), 0–60°
- **Bevel** = blade tilt from vertical (rotation around Z for X-face cuts, X for Z-face cuts), -60° to +60°
- **Surface pivot:** positive bevel pivots from board bottom, negative from top — the cut starts flush at the contact surface, not the center
- Transform chain: `shiftToPivot × miterRotY × bevelRot × shiftToOrigin`
- Bevel rotation uses compound matrix: `T(+pivot) × R × T(-pivot)` where pivotY = bottom or top face
- UI: separate sliders for Miter (0–60°) and Bevel (-60 to +60°) with descriptive labels
- Summary strings in both ToolsPanel and InspectorPanel show bevel when > 0

### Cabinet Builder
- **New file:** `src/components/dialogs/CabinetBuilderDialog.jsx`
- **Modified:** `actions.js`, `useStore.js`, `AddComponentPanel.jsx`, `App.jsx`
- Dialog with inputs for overall Width/Height/Depth + separate thickness controls for top/bottom, sides, front, back
- **Defaults:** top/bottom = 0.5", sides = 0.5", front = 0.5", back = 0.25"
- **Panel layout:**
  - Top/Bottom: full cabinet width, overlap sides at corners (for dado joints)
  - Left/Right: full cabinet height, core depth only
  - Front/Back: full width × full height, flush-attached (no overlap), add to total depth
- Back-bottom-left corner at world origin (0,0,0)
- Live panel summary with computed sizes and validation (core depth > 0, etc.)
- Accessible from "Add Component" panel as a new "Cabinet" card

---

## Confirmed: Rotation Analysis Complete
All 4 phases from the rotation analysis (conversation `8f001e86`) were verified as done:
- Phase 1: `rotation` → `orientation` rename, Apply button removed ✅
- Phase 1.5: YXZ Euler + quaternion incremental rotation ✅
- Phase 2: Flush constraints on oriented boards (`localFaceToWorld`) ✅
- Phase 2.5: Incremental orientation UI (Pitch/Yaw/Roll + axis helper) ✅
- Phase 3: Dimension overlays stick to rotated boards ✅
- Phase 4: `applyRotation`, `remapSignedFace`, taper remapping all deleted ✅

---

## Testing Needed (Tomorrow)
- **Compound miter:** Test bevel on all 4 faces (x+, x-, z+, z-) and verify geometry correctness
- **Compound miter:** Test negative bevel values — confirm cut starts from top surface
- **Compound miter:** Test combined miter + bevel (e.g., 45° miter + 30° bevel for picture frame compound cuts)
- **Cabinet builder:** Build a cabinet, then apply dual dado joints on the overlapping top/bottom + side corners
- **Cabinet builder:** Verify overall dimensions match inputs (back-bottom-left at origin)
- **Cabinet builder:** Test with extreme thickness values (e.g., 1" panels on a small cabinet)
- **Save/Load:** Ensure compound miter `bevel` property persists through save → load cycle
- **Save/Load:** Ensure cabinet assemblies persist correctly

