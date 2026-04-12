import os
file_path = 'd:/Antigravity Dev/Sketch/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "let finalY = maxY + (thickness / 2);" in line:
        if "let trimNotice =" in lines[i+2]: # Found the start!
            skip = True
            
            new_lines.append("                const finalY = maxY + (thickness / 2);\n")
            new_lines.append("\n")
            new_lines.append("                let trimNotice = \"\";\n")
            new_lines.append("\n")
            new_lines.append("                // Calculate the absolute internal architectural span\n")
            new_lines.append("                const geometricBase = minY !== Infinity ? minY : 0;\n")
            new_lines.append("                const projectedAssemblyHeight = (maxY + thickness) - geometricBase;\n")
            new_lines.append("\n")
            new_lines.append("                // If global bounding constraints are active, evaluate physical volumetric breach\n")
            new_lines.append("                if (globalBounds.enabled && projectedAssemblyHeight > globalBounds.y) {\n")
            new_lines.append("                    trimNotice = `\\n\\nWARNING: The generated Top extends to ${projectedAssemblyHeight.toFixed(2)}\", which exceeds your workspace height limit of ${globalBounds.y}\". You may want to manually move it or resize the legs.`;\n")
            new_lines.append("                }\n")
            new_lines.append("\n")
            new_lines.append("                const newId = Date.now();\n")
            new_lines.append("                const pId = targets[0]?.parentId || 'Workspace';\n")
            new_lines.append("\n")
            new_lines.append("                const pMatrix = getGlobalMatrix(pId, false);\n")
            new_lines.append("                pMatrix.invert();\n")
            new_lines.append("\n")
            new_lines.append("                const localPos = new THREE.Vector3(newX, finalY, newZ).applyMatrix4(pMatrix);\n")
            new_lines.append("                const localEuler = new THREE.Euler().setFromRotationMatrix(pMatrix, 'XYZ');\n")
            new_lines.append("\n")
            new_lines.append("                setBoards(prev => {\n")
            new_lines.append("                    return [...prev, {\n")
            new_lines.append("                        id: newId, name: 'Table Top', parentId: pId,\n")
            new_lines.append("                        size: [newWidth, thickness, newDepth],\n")
            new_lines.append("                        position: [localPos.x, localPos.y, localPos.z],\n")
            new_lines.append("                        rotation: [localEuler.x, localEuler.y, localEuler.z],\n")
            new_lines.append("                        material: defaultMaterial,\n")
            new_lines.append("                        joint: 'None', constraints: []\n")
            new_lines.append("                    }];\n")
            new_lines.append("                });\n")
            continue
            
    if skip and "setSelectedItemIds([newId.toString()]);" in line:
        skip = False
        new_lines.append(line)
        continue
        
    if not skip:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Replacement Complete.")
