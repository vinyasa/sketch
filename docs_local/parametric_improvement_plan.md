# Parametric Improvement Plan

Based on my analysis of the `src/` directory, I've identified several areas for improvement across code quality, parametric features, and UX/UI. Here is an incremental plan to achieve these goals.

### Phase 2: Code Cleanup and Modularization (Goal 1)
The application currently suffers from "God Object" anti-patterns.
- **[MODIFY] `src/store/actions.js` (182 KB, 3700+ lines):** Break this monolithic store into smaller, domain-specific Zustand slices in a new `src/store/slices/` directory. For example: `boardSlice.js`, `constraintSlice.js`, `assemblySlice.js`, and `ioSlice.js`.
- **[MODIFY] `src/components/Viewport3D.jsx` (98 KB):** Extract the Three.js rendering logic into smaller modular components, such as `<BoardRenderer>`, `<GridEnvironment>`, and `<GizmoControls>`. Move complex raycasting and interaction logic into custom hooks like `useSelection.js`.
- **[MODIFY] Large UI Panels:** Refactor `InspectorPanel.jsx` (72 KB) and `ToolsPanel.jsx` (61 KB) by extracting repeated sub-components (e.g., transform inputs, material pickers).

### Phase 2: Advancing Parametric Standards (Goal 2)
To move closer to true parametric CAD standards:
- **Non-Destructive Assemblies:** Currently, macros like the Cabinet Builder generate a static group of boards. If the user wants to change the width, they must delete and rebuild it. We need to introduce a persistent `AssemblyNode` in the state. This node will retain its generation parameters (width, height, depth), allowing the user to select the cabinet later and adjust sliders in the Inspector, instantly updating all child boards.
- **Face Frame Generator:** A new parametric tool that takes an opening size and automatically calculates and places standard stiles and rails.
- **Parametric Shelving:** A tool where the user selects an internal space, specifies "3 adjustable shelves," and the system auto-calculates spacing, adding the shelf boards and pin holes.
- **Smart Fasteners / Virtual Router:** Add tools to apply standard joinery (pocket holes, dowels) and edge treatments (roundovers, chamfers) procedurally.

### Phase 3: Intuitive UX/UI for Woodworkers (Goal 3)
To make the tool feel less like engineering CAD and more like a woodshop assistant:
- **Visual Builder Previews:** Instead of just text fields in the dialogs (e.g., `DrawerBuilderDialog`), show a real-time, transparent 3D preview in the viewport that updates as the user adjusts dimensions.
- **Smart Snapping:** Enhance the constraint solver to allow intuitive drag-and-drop auto-snapping of standard lumber (like wood glue), rather than requiring explicit multi-step constraint dialogs.
- **Lumberyard Snap:** Introduce a toggle that automatically snaps typed dimensions to actual standard lumber sizes (e.g., typing "2x4" snaps to 1.5" x 3.5").
- **Workspace Layout:** Consider transitioning from freely floating draggable panels to a clean, docked sidebar layout to maximize the 3D canvas area and prevent window overlap fatigue.
