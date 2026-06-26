# Luceysketch Architecture Overview

This document gives contributors a practical map of the current Luceysketch codebase: what the app does, how the major systems fit together, and which files to open first when working on a feature.

It is intentionally based on the current implementation in this repository rather than an idealized future design.

---

## 1. Product Summary

Luceysketch is a browser-based 3D parametric design tool for woodworking projects. It is built around a Three.js viewport and a Zustand store that model boards, assemblies, operations, constraints, materials, and shop-oriented outputs like cut lists and plywood layouts.

Primary user workflows include:

- creating custom boards and basic shapes
- generating assemblies with parametric builders
- editing board dimensions, transforms, pivots, and materials
- applying tool operations like holes, coves, arcs, and joints
- organizing boards into assemblies in the outliner
- reviewing cut lists and plywood sheet layouts
- saving/loading/exporting projects
- using AI-assisted commands to manipulate the workspace

---

## 2. Technology Stack

Core technologies are defined in `package.json`:

- **React 19** for UI
- **Vite** for dev/build tooling
- **Three.js** for 3D scene logic
- **@react-three/fiber** for declarative scene rendering
- **@react-three/drei** for camera/helpers
- **Zustand** for centralized application state
- **three-mesh-bvh** and **three-bvh-csg** for spatial and geometry operations

The app is primarily frontend-driven. A small PHP layer in `public/api/` is used as a production proxy for Gemini requests.

---

## 3. Top-Level Structure

Important top-level paths:

- `README.md` — product overview and setup
- `docs/user_manual.md` — user-facing guide shown by the app
- `src/` — application source code
- `public/` — static assets, textures, models, PHP proxy files
- `scripts/bump.js` — release/version helper
- `vite.config.js` — Vite config and user manual watcher

Source folders under `src/`:

- `components/` — viewport, panels, dialogs, layout pieces
- `store/` — Zustand store and action slices
- `services/` — AI/Gemini and simple command processing
- `utils/` — generators, geometry, layout, materials, constraints, units, packing

---

## 4. Runtime Architecture

At runtime, the app is organized around four main layers:

1. **App shell / workspace composition**
2. **Centralized state in Zustand**
3. **3D viewport rendering and interaction**
4. **Domain utilities and generators**

### 4.1 App shell

The entrypoint is:

- `src/main.jsx`
- `src/App.jsx`

`App.jsx` is currently the main composition layer. It is responsible for:

- rendering the viewport
- rendering the top header/navigation
- showing floating or docked panels
- mounting dialogs/builders
- handling some global side effects such as autosave and overlap warnings
- presenting toast and confirmation overlays

`App.jsx` is therefore one of the best files to read first when understanding how the workspace is assembled.

### 4.2 Centralized state

The global store lives in:

- `src/store/useStore.js`
- `src/store/actions.js`
- `src/store/slices/*.js`

The store holds both domain state and a significant amount of UI state.

Examples of store responsibilities:

- boards and groups
- selected items
- panel visibility
- dialog state
- constraints and operations
- measurements and camera state
- autosave and persistence
- history / undo / redo
- animation state
- library and hardware persistence

Slices currently include:

- `assemblySlice.js`
- `boardSlice.js`
- `constraintSlice.js`
- `ioSlice.js`
- `librarySlice.js`
- `operationSlice.js`
- `recorderSlice.js`

### 4.3 3D viewport

The main viewport entry is:

- `src/components/Viewport3D.jsx`

This component sets up:

- the React Three Fiber `Canvas`
- perspective/orthographic camera switching
- persistent controls/gizmos
- lights and grid environment
- board rendering
- measurement overlays
- bounding boxes and constraint visualization
- print capture and builder previews

Key related components include:

- `BoardRenderer.jsx`
- `GizmoControls.jsx`
- `PersistentControls.jsx`
- `SceneLights.jsx`
- `GridEnvironment.jsx`
- `MeasurementOverlay.jsx`
- `ConstraintVisualizer.jsx`
- `BoundingBoxVisualizer.jsx`
- `BuilderPreviewRenderer.jsx`
- `MiterCutVisualizer.jsx`

### 4.4 Domain utilities and generators

Most woodworking-specific modeling logic lives under:

- `src/utils/`

Important utility areas include:

- `utils/generators/` — procedural builders
- `constraintSolver.js` — movement/constraint propagation
- `collisions.js` — overlap checks
- `sceneGraph.js` — group/child board traversal
- `sheetPacker.js` — plywood layout planning
- `materialCatalogue.js` — wood and paint materials
- `units.js` — unit parsing/formatting
- `procedural.js` / `proceduralUpdaters.js` — procedural board updates
- `geometryBuilders.js` — mesh/shape helper logic

---

## 5. Core Domain Concepts

The app is centered on a few important concepts.

### 5.1 Boards

Boards are the basic physical modeling unit. A board typically has fields such as:

- `id`
- `name`
- `parentId`
- `size`
- `position`
- `orientation`
- `material`
- `shape`
- `operations`
- `lumberType`
- `grainDirection`

Boards may represent plain rectangular stock, tapered parts, plane helpers, or other generated shapes depending on the workflow.

### 5.2 Groups / assemblies

Groups form the scene hierarchy and are used to organize projects into assemblies and subassemblies.

They are managed in the store and exposed in:

- `src/components/panels/OutlinerPanel.jsx`

Groups support:

- nesting
- expansion/collapse
- visibility inheritance
- drag-and-drop parenting

### 5.3 Operations

Operations are non-destructive modifiers or joinery/cut descriptors applied to boards.

Examples seen in the current codebase include:

- hole
- cove
- arc
- dado/rabbet-like features
- subtraction-based cuts
- edge-joint-derived operations
- assembly profiling operations

These are surfaced primarily through:

- `src/components/panels/ToolsPanel.jsx`
- `src/store/slices/operationSlice.js`
- geometry/procedural utility files in `src/utils/`

### 5.4 Constraints

Constraints encode relations between parts so movement and alignment can propagate.

Examples in the current app:

- flush alignment
- glue

Relevant files:

- `src/store/slices/constraintSlice.js`
- `src/utils/constraintSolver.js`
- `src/components/ConstraintVisualizer.jsx`

### 5.5 Materials and hardware

Materials are modeled as wood species or colors/paint.

Relevant files:

- `src/utils/materialCatalogue.js`
- `src/components/panels/MaterialsPanel.jsx`
- textures in `public/textures/`

Hardware-related files include:

- `src/utils/hardwareCatalogue.js`
- `src/components/panels/HardwarePanel.jsx`
- models in `public/models/`

---

## 6. Major User Workflows and Where They Live

This section maps the main workflows to files.

### 6.1 Add a custom board or component

Primary files:

- `src/components/panels/AddComponentPanel.jsx`
- `src/components/dialogs/NewBoardDialog.jsx`
- `src/store/slices/boardSlice.js`
- `src/utils/lumberyard.js`

What happens:

- user opens Components
- enters dimensions/material/location
- store action creates the new board
- board appears in viewport and outliner

### 6.2 Build a procedural assembly

Primary files:

- `src/components/panels/AssembliesPanel.jsx`
- `src/components/dialogs/*BuilderDialog.jsx`
- `src/utils/generators/*.js`
- assembly-related store actions in `src/store/slices/assemblySlice.js`

Builder examples:

- cabinet
- drawer
- box
- face frame
- shaker door
- shelving
- table base
- table top

What happens:

- user opens a builder dialog
- parameters are collected
- generator creates a group and board set
- generated parts are inserted into workspace

### 6.3 Edit board geometry and transforms

Primary files:

- `src/components/panels/InspectorPanel.jsx`
- `src/components/panels/SingleBoardInspector.jsx`
- `src/components/panels/MultiSelectInspector.jsx`
- `src/store/slices/boardSlice.js`
- `src/components/GizmoControls.jsx`

What happens:

- user edits dimensions, position, pivot, rotation, visibility, etc.
- store updates board state
- viewport rerenders the result

### 6.4 Apply tool operations and joints

Primary files:

- `src/components/panels/ToolsPanel.jsx`
- `src/store/slices/operationSlice.js`
- geometry/procedural utilities in `src/utils/`

What happens:

- tool UI changes based on selection
- user adds or edits operations
- board geometry is updated through rendering/procedural logic

### 6.5 Organize assemblies in the outliner

Primary files:

- `src/components/panels/OutlinerPanel.jsx`
- `src/utils/sceneGraph.js`
- assembly/board actions in the store

What happens:

- user selects, groups, re-parents, hides, or expands items
- hierarchy affects organization and visibility behavior

### 6.6 Review cut list and plywood layouts

Primary files:

- `src/components/panels/CutListPanel.jsx`
- `src/utils/sheetPacker.js`
- `src/utils/materialCatalogue.js`

What happens:

- boards are grouped by dimensions/material
- plywood boards can be laid out into printable sheet plans
- output is prepared for print or reporting workflows

### 6.7 Save, load, export, and print

Primary files:

- `src/components/layout/AppHeader.jsx`
- `src/store/slices/ioSlice.js`
- persistence helpers in `src/utils/`
- `src/components/dialogs/PrintDialog.jsx`

What happens:

- local save/load interacts with browser storage
- disk export/import uses JSON workspace files
- GLB export uses scene/model data from the viewport/store
- print workflows render printable output panels/views

### 6.8 AI-assisted commands

Primary files:

- `src/components/panels/AIChatPanel.jsx`
- `src/services/siCommandProcessor.js`
- `src/services/geminiService.js`
- `public/api/gemini.php`
- `public/api/config.php`

Two modes currently exist:

1. **SI Engine** — local command interpretation for common actions
2. **AI Engine** — Gemini-backed structured action generation

What happens:

- user enters natural language
- input is parsed locally or sent to Gemini
- actions are translated into board/assembly changes
- results are applied to the store/workspace

---

## 7. UI Composition

The UI is built from several categories of components.

### 7.1 Layout components

Examples:

- `components/layout/AppHeader.jsx`
- `components/layout/DraggablePanel.jsx`
- `components/layout/ErrorBoundary.jsx`

These manage top-level chrome, floating panels, and error isolation.

### 7.2 Panels

Panels are the main workspace tools. Examples:

- `AddComponentPanel.jsx`
- `AssembliesPanel.jsx`
- `InspectorPanel.jsx`
- `OutlinerPanel.jsx`
- `ToolsPanel.jsx`
- `MaterialsPanel.jsx`
- `LightingPanel.jsx`
- `CutListPanel.jsx`
- `HardwarePanel.jsx`
- `AnimationPanel.jsx`
- `MeasurePanel.jsx`
- `AssemblyLibraryPanel.jsx`
- `AIChatPanel.jsx`

### 7.3 Dialogs

Dialogs are used for focused workflows and builder configuration.

Examples:

- `NewBoardDialog.jsx`
- `CabinetBuilderDialog.jsx`
- `DrawerBuilderDialog.jsx`
- `ShakerDoorBuilderDialog.jsx`
- `UserManualDialog.jsx`
- `PrintDialog.jsx`
- `SavePromptDialog.jsx`
- `WelcomeDialog.jsx`

---

## 8. Persistence Model

The current app uses a mix of browser persistence and file export.

### 8.1 Browser persistence

The app stores workspace-related data in browser storage, including autosave data. Some UI preferences are also persisted.

Relevant code:

- `src/store/useStore.js`
- `src/App.jsx`
- `src/utils/libraryPersistence.js`
- `src/utils/hardwareLibraryPersistence.js`

### 8.2 Workspace save/export

The app supports:

- local workspace save/load
- JSON import/export
- GLB export

Relevant code is primarily in:

- `src/store/slices/ioSlice.js`
- `src/components/layout/AppHeader.jsx`

### 8.3 Versioning

Version data is stored in:

- `src/version.json`

Release/version workflow is described in:

- `docs/versioning_guide.md`

---

## 9. External/API Integration

The main external integration currently present is Gemini.

### Development mode

If `VITE_GEMINI_API_KEY` is present, the frontend can call Gemini directly.

Relevant file:

- `src/services/geminiService.js`

### Production mode

In production, requests are proxied through PHP so the key stays server-side.

Relevant files:

- `public/api/gemini.php`
- `public/api/config.php`

The PHP config searches for a `.env-sketch` file in several locations and exposes the Gemini key through environment lookup.

---

## 10. Recommended Files to Read First

If you are new to the codebase, start with these files in roughly this order:

1. `README.md`
2. `src/App.jsx`
3. `src/components/Viewport3D.jsx`
4. `src/store/useStore.js`
5. `src/components/layout/AppHeader.jsx`
6. `src/components/panels/OutlinerPanel.jsx`
7. `src/components/panels/InspectorPanel.jsx`
8. `src/components/panels/ToolsPanel.jsx`
9. `src/components/panels/CutListPanel.jsx`
10. `src/utils/generators/cabinetGenerator.js`
11. `src/services/geminiService.js`
12. `docs/user_manual.md`

---

## 11. Current Architecture Notes

These notes reflect the current codebase shape and are useful context for contributors.

- `App.jsx` currently handles a large amount of orchestration and some global side effects.
- The Zustand store is the main integration point for both UI and domain behavior.
- Domain logic is spread across store slices and `src/utils/` helper modules.
- Much of the product value lives in pure logic that is testable independently of React rendering.
- The app already supports a rich set of woodworking-specific workflows, so changes should be validated against core flows rather than isolated components alone.

---

## 12. Practical Contributor Guidance

When making changes:

- start from the user workflow you are affecting
- identify the panel/dialog that triggers the action
- trace the store action or generator used by that workflow
- inspect the utility modules that transform geometry or workspace data
- verify the viewport and cut list behavior after changes

For UI changes, test:

- viewport interaction
- outliner selection
- inspector editing
- save/load behavior
- cut list results

For domain logic changes, test:

- generated board dimensions
- parent/child assembly placement
- material/grain handling
- operation updates
- constraint propagation

---

## 13. Related Documentation

- `README.md`
- `docs/user_manual.md`
- `docs/versioning_guide.md`
- `CONTRIBUTING.md`
- `SUPPORT.md`

This architecture overview should evolve alongside the codebase. When major systems move or new workflows are added, update this file so new contributors can orient themselves quickly.
