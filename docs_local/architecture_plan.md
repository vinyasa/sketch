# AI-Assisted Furniture Design App - Architecture & Ruleset

Building a natural-language-driven 3D CAD application involves separating the *intent* (what the user asks for) from the *math* (how it's calculated in 3D space). To make the AI smart and the cut list accurate, we need a robust **Parametric & Relational System**.

---

## 1. Core Philosophy: The Constraint System
Instead of rigid "rules", the engine will operate on a **Constraint System** (similar to advanced CAD tools like Fusion360 or SolidWorks). 

When you expand the global bounding box, the engine determines what changes size based on constraints:
*   **Absolute Constraints:** A property locked to a specific number. For example, a leg's cross-section is set to `1.5" x 1.5"`. If the table width doubles, the leg stays `1.5"`.
*   **Relative Constraints:** A property bound to relationships. The width of a Top is usually constrained to `100% of Bounding Box X`. If the table gets wider, the top stretches.
*   **Offsets (Nudging):** Constraints do not mean parts are permanently glued together in one spot. Every spatial constraint accepts an **Offset Vector `(x, y, z)`**. If a leg is constrained to the bottom of a Table Top, you can "nudge" it by `.5"` on the X-axis. It slides across the surface while remaining mathematically locked to the Top's general position. If you nudge it `.5"` down on the Y-axis, it creates a gap, but if the table moves up, the leg follows, maintaining that exact `.5"` air gap.
*   **Exceptions (Custom Overrides):** Any constraint can be overridden or deleted by the user to forcefully break inheritance. 

## 2. Handling Angles & Virtual Cuts (CSG)
If you place a straight leg, it obeys the constraint: `Top Y to Floor Y`. 
If you angle that leg by 10 degrees, keeping both the Top and Floor constraints would force the leg to mathematically get longer (the hypotenuse). 
*   **Constructive Solid Geometry (CSG):** To prevent tilted corners from clipping through the Table Top, the engine uses the flat plane of the Table Top as a virtual saw blade. It slices the top of the angled leg perfectly flush. The Cut List then translates this complex 3D shape back into shop instructions: *"Length: X, Miter: 10 degrees."*

## 3. Dimensions & Annotations
Just like wood components, Visual Dimensions are objects within the system. They use Three.js text sprites overlaid onto the 3D canvas.
*   **Dynamic Updating:** Because Dimension Annotations are mathematically constrained to the vertices of wood components, when the constraint solver resizes a Leg, the Annotation automatically updates its coordinates and redraws the exact numerical value. Toggleable at will.

## 4. Universal Object-Oriented Extensibility
The engine is NOT hardcoded to just "Tables". Every piece of wood or hardware in the system inherits from a universal `BaseComponent`. 

A `BaseComponent` inherently has:
*   An `ID` and `Material`
*   3D Geometry data
*   An array of active `Constraints` & `Local Offsets`

What we call a "Top", "Side", "Leg", "Box Bottom", or "Chair Arm" are simply semantic **Roles** applied to a `BaseComponent`. This allows infinite future extensibility.

## 5. Group Assemblies & The Outliner
In complex projects, users need to organize components into a hierarchical tree (identical in concept to SketchUp's Outliner).
*   **The Assembly Object:** Instead of a component floating freely in the global space, it can be parented to an `Assembly` object (e.g., a "Leg Group" or an entire "Drawer Slide Unit").
*   **Master Visibility Toggle:** An Assembly has a master `isVisible` property. Toggling this off recursively hides all child pieces of wood. This is critical for hiding a table top so you can work on the internal joists or locking mechanisms underneath.
*   **Cascading Offsets (Bulk Nudging):** Applying an offset constraint to an Assembly mathematically propagates that offset down to every child part. This allows logical commands like *"Move the entire drawer assembly down 2 inches"*, rather than manually recalculating the constraints for the bottom, sides, faces, and hardware slides.

## 6. Admin Dashboard & Data-Driven Definitions
To make the application limitlessly extensible without rewriting code, the definitions of "Roles" and "Rules" are separated from the core physics engine and stored as data.
*   **Admin Back-End:** A secure login where an Administrator can click "Create New Component Type".
*   **No-Code Configuration:** In the dashboard, you can define that a new "Chair Arm" defaults to `2" wide`, attaches to a "Backrest", and defaults to oak material. You don't have to touch the Javascript engine.
*   **Dynamic Loading:** When the app launches, it pulls these definitions. If you configure a "Drawer Slide" in the admin panel on Tuesday, the AI instantly knows how to use it on Wednesday. 

## 7. UI Customization & Theming
The interface is designed to accommodate different environments, devices, and preferences.
*   **Light / Dark Mode:** Native support for both. Dark mode (high contrast geometric viewing) and Light mode (often higher visibility in bright, dusty woodshop environments).
*   **Modular Layouts:** The side panels (AI Chat, Inspector, Cut List, and the new **Outliner Tree**) will be modular widgets. Users can drag to resize them or snap them to different edges of the screen.

## 8. The Joint Engine (Connection Rules)
When two boards meet, they form a **Joint Object** that resolves collisions for the Cut List.
*   **Toggle System:** The UI provides a toggle button to cycle configurations.
    *   *Config A (Butt 1):* Board X runs full length. Board Y is shortened.
    *   *Config B (Butt 2):* Board Y runs full length. Board X is shortened.
    *   *Config C (Miter):* CSG 45-degree angle slices applied to both.
    *   *Config D (Rabbet/Dado):* CSG volume subtraction applied to Board X. 

## 9. The AI Translation Pipeline
**Step 1: NLP Intent Extraction**
The LLM does *not* do 3D math. It generates spatial logic JSON.
*User:* `"Add a shelf 6 inches from the bottom and nudge it left 1 inch."`
*LLM Output:* `{"action": "add_component", "role": "shelf", "constraints": {"y_target": "floor", "offset_y": "6in", "offset_x": "-1in"}}`

**Step 2: The Constraint Solver (Javascript)**
The JS engine calculates the internal spans, applies offsets, executes CSG boolean cuts if angles are involved, and spawns Dimension Annotations.

**Step 3: Rendering & Cut List**
Three.js renders the final meshes. The Cut List parses the exact same math array.
