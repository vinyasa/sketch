# Sketch CAD: Feature Analysis & Proposals

## The CAD Landscape: Engineer vs. Craftsman

To build the ideal woodworking CAD, we need to understand where existing tools succeed and fail for this specific niche.

### 1. Fusion 360 / SolidWorks (The Engineer's Choice)
*   **Pros:** Incredible parametric modeling (change a dimension, everything updates), timeline history, precise joint kinematics.
*   **Cons for Woodworking:** Overkill. Dealing with sketches, extrusions, and assembly constraints feels like designing an engine rather than building a table. It lacks native understanding of "grain direction" or "standard lumber sizes" out of the box.

### 2. SketchUp (The Architect/Hobbyist's Choice)
*   **Pros:** Direct, intuitive "Push/Pull" modeling. Very easy to conceptualize space.
*   **Cons for Woodworking:** It's essentially a surface modeler. "Sticky geometry" can ruin models if components aren't grouped correctly. To get cut lists or wood-specific features, you rely heavily on third-party plugins.

### 3. FreeCAD (The Open-Source Powerhouse)
*   **Pros:** Deeply customizable, node-based workflows, free.
*   **Cons for Woodworking:** Extremely steep learning curve and a fragmented UI. It requires too much CAD knowledge to perform simple carpentry tasks.

**The "Sketch" Philosophy:** We want the intuitive, direct interaction of SketchUp, but with the domain-specific intelligence of a dedicated woodworking plugin. The user shouldn't be drawing rectangles and extruding them; they should be pulling "boards" from a rack and "cutting" them.

---

## Evaluating Your Ideas

Your ideas are spot on. They embrace the "push-button" macro philosophy that will make Sketch stand out.

1.  **Door Builder (Shaker Door):** **Excellent.** Shaker doors are tedious to draw manually (calculating stile lengths, rail lengths minus joinery, and the center panel size). A simple dialog asking for Overall Width, Height, and Frame Width would save minutes of work per door.
2.  **Add Doors (Smart Placement):** **Game Changer.** Placing hinges and aligning doors with proper reveals (gaps) is notoriously annoying in CAD. If a user can click a cabinet opening and say "Add Double Doors, 1/8\" reveal, overlay hinges," that is a massive productivity boost.
3.  **Fun Painter (Palette Randomizer):** **Great for UX.** Woodworkers often struggle with visualizing colors. Having "theme buttons" (e.g., Mid-Century Modern, Farmhouse, Scandinavian) that instantly map materials/paints to the assembly makes the design process playful and inspiring.
4.  **Add Legs:** **Highly Practical.** Dropping pre-modeled, parametric legs (tapered, hairpin, turned) onto a tabletop or cabinet base is exactly the kind of assembly shortcut users love.

---

## Proposed "Push-Button" Features

Putting on my Craftsman's hat, here are additional features organized by workflow stage, balancing visual appeal with genuine utility.

### Category 1: The "Maker" Macros (Generators)
These tools build complex, standard assemblies instantly.
*   **Drawer Box Builder:** Similar to the door builder. Ask for opening dimensions, clearance, and material thickness. Automatically generates the front, back, sides, and bottom panel (with dado grooves).
*   **Face Frame Generator:** Select the front edges of a cabinet carcass, and the tool automatically generates a 1.5" standard face frame with stiles and rails perfectly aligned.
*   **Parametric Shelving:** Select an internal space (like a cabinet interior) and specify "3 adjustable shelves." The tool calculates the spacing and adds the shelf boards and pin holes.

### Category 2: The "Shop" Tools (Joinery & Edge Treatment)
These tools automate the tedious, repetitive cuts.
*   **Auto-Groove / Dado:** Instead of manually modeling a cut, the user selects a board, clicks "Add Groove," and specifies distance from edge and depth. Crucial for drawer bottoms and cabinet backs.
*   **Smart Fasteners (Pocket Holes & Dowels):** The user selects a joint (where two boards meet). The tool automatically places 3D pocket hole cutouts or dowel pins, properly spaced. This adds incredible realism and helps plan assembly.
*   **The Virtual Router (Edge Profiling):** A one-click tool to select the top edges of a table and apply a "Roundover," "Chamfer," or "Ogee" profile. This is very hard to do in basic CAD but makes the final render look premium.

### Category 3: The "Lumberyard" (Utility)
These features bridge the gap between digital design and the physical shop.
*   **1-Click Cut List (BOM):** The Holy Grail for woodworkers. An instant, formatted table showing Board Name, Quantity, Thickness, Width, and Length.
*   **Grain Direction Visualizer & Aligner:** Woodworkers *must* care about grain. A tool that highlights the grain direction of all boards and allows a 1-click 90-degree rotation.
*   **Standard Lumber Snap:** A toggle that automatically snaps board dimensions to actual lumber sizes (e.g., typing "2x4" snaps to 1.5" x 3.5", typing "3/4 plywood" snaps to actual typical thickness like 23/32").

---

## Implementation Strategy: The "Balance"

To maintain ease of use:
1.  **Hide the Math:** The user inputs the *desired outcome* (e.g., "Cabinet Width: 36 inches"), and the system does the math for the component parts.
2.  **Visual Dialogs:** When running a macro like "Door Builder," use a small 2D or 3D preview in the dialog box that updates as they change dimensions, rather than just text fields.
3.  **Non-Destructive Macros:** If I build a Shaker door, I should be able to click it later and change the stile width from 2" to 3", rather than having to delete it and rebuild it.
