# Sketch CAD: Project Philosophy & Design Manifesto

Welcome to **Sketch**, an open-source, browser-based, parametric 3D CAD application built specifically for **woodworkers**, not software engineers or industrial designers. 

This document serves as the guide for all contributors, setting forth the target audience philosophy, user-experience goals, code quality standards, and our release roadmap.

---

## 1. The Core Philosophy: The Craftsman vs. The Engineer

Most 3D CAD software (e.g., Fusion 360, SolidWorks, FreeCAD) is built with an *engineering* mindset:
*   Users draw 2D sketches, apply algebraic constraints, and extrude them into solid bodies.
*   The vocabulary is filled with engineering jargon: *extrusions, sweeps, constraints, quaternions, axes, vectors*.
*   For woodworkers, this is massive overkill. It forces them to design like they are machining engine parts rather than milling wood.

**Sketch is different.** It is designed for **beginner and intermediate woodworkers**:
*   **The Woodshop Paradigm:** Users don't draw abstract shapes and extrude them. They pull standard lumber/boards from a visual "rack," "cut" them on a virtual table saw or miter saw, and "assemble" them in 3D space.
*   **Craftsman Vocabulary:** The code and the UI must always speak the language of a carpenter:
    *   *Board, Leg, Shelf, Top* instead of *Mesh, Cuboid, Box*.
    *   *Thickness, Width, Length* instead of *Scale X, Y, Z*.
    *   *Miter, Bevel, Dado, Rabbet* instead of *CSG Subtraction, Rotation Y, Pivot Shift*.
*   **Focus on the Cut List:** The ultimate goal of a woodworking CAD tool is not a perfect render; it is a **100% accurate physical Cut List (BOM)** that the user can take to their workshop. Every visual feature must translate accurately to real-world dimensions and saw setups.

### 1.5. The Workbench vs. The Room: Local vs. World Coordinates

One of the steepest learning curves in traditional 3D design is understanding coordinate systems. To keep Sketch intuitive, we must translate "Local vs. World Coordinates" into real-world shop analogies:
*   **Local Coordinates ("The Board on the Workbench"):** When a woodworker is holding a single board on their workbench, the board has its own fixed orientation. Its length is along its grain, its thickness is from face to face, and its width is from edge to edge. When making a cut (like a miter or a bevel), it is always measured relative to *this* board's local coordinates.
*   **World Coordinates ("The Finished Piece in the Room"):** Once that board is rotated and assembled into a table (e.g., tilted at 10 degrees for a splayed leg), its local orientation no longer aligns with the floor or the walls of the room.
*   **The Golden Rules for Sketch Development & UI:**
    1.  **Cuts and Dimensions stick to the local board:** Adjusting the *length* of a board must always stretch it along its local grain (local length axis), even if it is rotated in 3D space. Miter and bevel cuts must stay fixed to the board's ends relative to its grain.
    2.  **Nudging can be toggled or contextual:** When a user wants to move a rotated board, they might want to slide it along its length (local axis) or move it straight up/down relative to the floor (world axis). The UI must make this choice clear and simple to toggle, using plain-English descriptions (e.g., "Slide along board" vs. "Move in project").
    3.  **No Pilot Jargon (Rotation terms):** Avoid aircraft terms like "Pitch", "Yaw", and "Roll". Instead, translate them to clear, real-world woodworking actions:
        *   **Pitch** $\rightarrow$ **Tilt Front/Back** (tilting the board forward or backward).
        *   **Yaw** $\rightarrow$ **Spin Flat** (spinning the board flat on the table, like a turntable).
        *   **Roll** $\rightarrow$ **Tilt Left/Right** (tilting the board sideways).

### 1.6. The Global Tape Measure: Imperial vs. Metric

To welcome woodworkers worldwide, Sketch supports both the **Imperial system** (inches and fractional $1/16^{\prime\prime}$ or $1/8^{\prime\prime}$ increments) and the **Metric system** (millimeters). 

To ensure this is $100\%$ bulletproof and allows users to switch systems in the middle of a build without corrupting their data, we follow these architectural rules:
1.  **Single Internal Source of Truth:** Internally, the database and core 3D engine store all dimensions and coordinates in a single unit (inches). This is completely invisible to metric users.
2.  **Zero Loss on Mid-Project Switch:** Because the underlying data is kept in standard internal units, switching between Imperial and Metric in the settings will never break or scale the physical coordinates. It simply changes the active display and input formulas!
3.  **Bidirectional Input/Output Adapters:**
    *   *Output display:* If Metric is active, convert raw inches to millimeters (`val * 25.4`) and display with the `mm` suffix.
    *   *Input fields:* If Metric is active, display the input field in millimeters. When the user types a new millimeter value, automatically divide it by `25.4` before committing the change to the store.
4.  **Adaptive Grid Snapping:**
    *   When the unit system is changed, the grid snapping options in the **Settings** panel must dynamically update:
        *   *Imperial Snapping:* `1/16"`, `1/8"`, `1/4"`, `1/2"`, `1"`.
        *   *Metric Snapping:* `1mm`, `2mm`, `5mm`, `10mm`, `25mm`.
    *   The 3D grid environment and inspector must read these snapped increments, converting metric snaps to their corresponding decimal inch values (`snapMM / 25.4`) so snapping remains accurate.

---

## 2. User Experience (UX) & Intuitive Controls

To keep the application highly accessible to beginners, we follow these UX principles:
1.  **Hide the Math, Show the Results:** The user inputs what they want (e.g., *"Cabinet Width: 36 inches"*) and the parametric system handles calculating individual side-panel and shelf dimensions.
2.  **No Dead Ends:** The user should never see a black screen, crash, or an incomprehensible error message. If an input is invalid (e.g., a negative board thickness), the application must gracefully clamp it to a safe default, and pop up a gentle reminder (e.g., a temporary toast message) that the value was corrected to prevent confusion.
3.  **One-Click "Push-Button" Macros:** Complex woodworking sub-assemblies (like Drawer Boxes, Shaker Doors, Face Frames, and Parametric Shelves) must be easily generated using simple visual dialogs with 2D/3D previews.
4.  **Visual Overlays:** Use high-contrast, beautiful dimension lines, face identifiers, and grain-direction visualizers so users instantly understand their model's spatial relationships.

---

## 3. Code Standards & Open-Source Readability

Since we are preparing to share this project with the world on GitHub, the code must be a masterclass in readability and documentation. 

*   **No "Clever" or Cryptic Code:** Avoid deeply nested ternary operators, highly abbreviated variables, or overly magic math formulas. Write self-documenting code.
*   **Strict Variable Naming:** 
    *   `boardThickness` instead of `t` or `thk`.
    *   `miterAngle` instead of `m` or `ang`.
    *   `worldPositionX` instead of `x`.
*   **Zustand Store Slices:** Keep actions and state mutation modular. Slices must be split logically (e.g., `boardSlice`, `assemblySlice`, `ioSlice`) and documented with standard JSDoc comments explaining:
    *   *What* the function does.
    *   *Why* the math works the way it does.
*   **Clean Three.js and CSG separation:** Keep computational geometry (matrix transforms, miter plane cuts) clearly separated from React render cycles.

---

## 4. Bug-Free & Edge Case Defense System

A robust tool builds trust. We must defend against common CAD bugs with absolute discipline:
*   **Zero-or-Negative Boundary Protection:** Clamp all dimensional inputs to positive values.
*   **Float Accuracy Control:** Always round display dimensions and Cut List entries to reasonable shop fractions (e.g., nearest $1/16^{\prime\prime}$ or $1/32^{\prime\prime}$ or $0.1\,\text{mm}$) rather than displaying raw floating-point numbers like `12.000000000004"`.
*   **AABB & Collision Warnings:** Highlight physical board overlap in red or trigger warning badges when boards occupy the same physical space, helping the user catch design errors before making cuts.
*   **Reliable Undo/Redo:** History must record all parameter edits, additions, and joint configuration toggles completely, ensuring a reliable fallback path.

---

## 5. Line of Code (LOC) Accountability Protocol

Every development step and pull request must remain lean and clean. We actively track the quantity of code added or reduced to ensure we do not bloat the codebase:
*   Every code change or feature branch must declare the count of lines added and removed.
*   Aim to reduce code complexity by refactoring duplicated logic, utilizing shared utility functions, and avoiding ad-hoc styling.

---

## 6. Pre-Launch Roadmap

Before the public open-source launch, we are working to complete the following:
1.  **Robustness Polish:** Audit miter/bevel compound calculations and state save/load operations.
2.  **Auto-Groove & Dado cuts:** Implementing one-click slotting for cabinet backing and drawer bottoms.
3.  **Visual Polish & Theme Enhancements:** Beautiful dark/light modes, grain alignment visualizers, and polished typography.
4.  **Community Onboarding:** Ensure clean documentation, contributing guidelines, and an interactive tutorial for beginners.
