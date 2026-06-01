# AI Furniture App - JSON Data Schema

This schema represents the single source of truth for the application state. The JS Math Engine reads this JSON to calculate sizes, Three.js reads it to render the scene, and the Cut List reads it to generate woodworking shop instructions.

```json
{
  "project": {
    "id": "proj_9876",
    "name": "Custom Workbench",
    "environment": {
      "unit": "imperial",   // "imperial" or "metric"
      "resolution": 0.0625, // 1/16" snapping grid
      "boundingBox": {
        "width": 64.0,
        "height": 38.0,
        "depth": 30.0
      }
    },
    
    // Global User Preferences stored from the UI Phase
    "settings": {
      "theme": "dark",
      "showDimensionsAuto": false
    },

    // The Master Array. Handles both Group Assemblies and Generic Components
    "entities": [
      {
        "id": "assem_top_group",
        "type": "Assembly",
        "name": "Main Table Top",
        "isVisible": true,
        "globalOffset": { "x": 0, "y": 0, "z": 0 },
        
        // Children inside this assembly
        "children": [
          {
            "id": "comp_top_1",
            "type": "GenericComponent",
            "role": "Top",        // This references the Admin Data Dictionary
            "material": "maple",
            "isVisible": true,
            
            // Hardcoded dimensions that do NOT stretch
            "absoluteConstraints": {
              "thickness": 1.5
            },
            
            // The relational math rules
            "spatialConstraints": [
              {
                "targetId": "environment",
                "targetFace": "top",
                "relationship": "coincident",
                "offset": { "x": 0, "y": 0, "z": 0 }
              },
              {
                "targetId": "environment",
                "targetFace": "width",
                "relationship": "fill_100_percent",
                "offset": { "x": 0, "y": 0, "z": 0 }
              }
            ],
            
            // Defines how this piece reacts if it collides with another piece
            "jointModifiers": []
          }
        ]
      },
      
      {
        "id": "assem_leg_group",
        "type": "Assembly",
        "name": "Legs",
        "isVisible": true,
        "globalOffset": { "x": 0, "y": 0, "z": 0 },
        "children": [
          {
            "id": "comp_leg_fl",
            "type": "GenericComponent",
            "role": "Leg",
            "material": "oak_dark",
            "absoluteConstraints": {
              "thicknessX": 3.0,
              "thicknessZ": 3.0
            },
            "spatialConstraints": [
              {
                "targetId": "environment",
                "targetFace": "floor",
                "relationship": "coincident"
              },
              {
                "targetId": "comp_top_1",
                "targetFace": "bottom",
                "relationship": "coincident",
                "offset": { "x": 0, "y": 0, "z": 0 } // A nudge would go here
              },
              {
                "targetId": "comp_top_1",
                "targetFace": "front_left_corner",
                "relationship": "inset",
                "offset": { "x": 1.0, "y": 0, "z": 1.0 } // 1 inch overhang
              }
            ],
            
            // Example of a Cut List logic override via CSG
            "jointModifiers": [
              {
                "targetId": "comp_apron_front",
                "mode": "mortise_and_tenon", 
                "priority": "dominant" // Meaning the apron gets the tenon, the leg gets the mortise cut
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Key Schema Features
1. **Separation of Types:** The `type` determines if it is an `Assembly` (a folder) or a `GenericComponent` (a physical shape). 
2. **Abstracted Dimensions:** Notice there is no "Length" property on the Leg object. The length is mathematically solved at runtime by strictly adhering to the `spatialConstraints` (Floor to Top_Bottom). 
3. **Offset Matrix Built-In:** The spatial constraints inherently expect an `offset` object. This supports your exact requirement of moving/nudging things manually without deleting the relationship.
4. **Joint Modifiers:** Joints are tracked per-component. When the physics engine detects an intersection between `comp_leg_fl` and `comp_apron`, it reads the `mortise_and_tenon` modifier and runs the CSG boolean cuts correctly.
