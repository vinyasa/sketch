import React from 'react';
import useStore from '../store/useStore';

export default function BuilderPreviewRenderer() {
    const {
        boxDialog,
        cabinetDialog,
        shelvingDialog,
        shakerDoorDialog,
        faceFrameDialog,
        theme
    } = useStore();

    let previewBoards = [];

    const parseNum = (val, def) => {
        if (val === undefined || val === null || val === '') return def;
        const n = parseFloat(val);
        return isNaN(n) ? def : n;
    };

    // 1. Box Preview
    if (boxDialog) {
        const W = parseNum(boxDialog.width, 18);
        const H = parseNum(boxDialog.height, 12);
        const D = parseNum(boxDialog.depth, 12);
        const tTB = parseNum(boxDialog.thicknessTB, 0.5);
        const tSide = parseNum(boxDialog.thicknessSide, 0.5);
        const tFront = parseNum(boxDialog.thicknessFront, 0.5);
        const tBack = parseNum(boxDialog.thicknessBack, 0.5);
        const coreH = H - 2 * tTB;
        const coreD = D - tFront - tBack;
        
        let offset = [parseNum(boxDialog.offsetX, 0), parseNum(boxDialog.offsetY, 0), parseNum(boxDialog.offsetZ, 0)];

        const panels = [
            { size: [W, tTB, D], pos: [W / 2, tTB / 2, D / 2] },
            { size: [W, tTB, D], pos: [W / 2, H - tTB / 2, D / 2] },
            { size: [tSide, coreH, coreD], pos: [tSide / 2, H / 2, D / 2] },
            { size: [tSide, coreH, coreD], pos: [W - tSide / 2, H / 2, D / 2] },
            { size: [W, coreH, tBack], pos: [W / 2, H / 2, tBack / 2] },
            { size: [W, coreH, tFront], pos: [W / 2, H / 2, D - tFront / 2] }
        ];

        previewBoards = panels.map(p => ({
            size: p.size,
            position: [p.pos[0] + offset[0], p.pos[1] + offset[1], p.pos[2] + offset[2]]
        }));
    }

    // 2. Cabinet Preview
    if (cabinetDialog) {
        const W = parseNum(cabinetDialog.width, 24);
        const H = parseNum(cabinetDialog.height, 30);
        const D = parseNum(cabinetDialog.depth, 14);
        const tTB = parseNum(cabinetDialog.thicknessTB, 0.75);
        const tSide = parseNum(cabinetDialog.thicknessSide, 0.75);
        const tFront = parseNum(cabinetDialog.thicknessFront, 0.75);
        const tBack = parseNum(cabinetDialog.thicknessBack, 0.25);
        const backStyle = cabinetDialog.backStyle ?? 'flat';
        const coreD = backStyle === 'flat' ? D - tBack : D;
        const coreMidZ = backStyle === 'flat' ? tBack + coreD / 2 : coreD / 2;
        let offset = [parseNum(cabinetDialog.offsetX, 0), parseNum(cabinetDialog.offsetY, 0), parseNum(cabinetDialog.offsetZ, 0)];

        let backSize, backPos;
        if (backStyle === 'flat') {
            backSize = [W, H, tBack];
            backPos = [W / 2, H / 2, tBack / 2];
        } else {
            backSize = [W - tSide, H - tTB, tBack];
            backPos = [W / 2, H / 2, tBack / 2];
        }

        const panels = [
            { size: [W - 2 * tSide, tTB, coreD], pos: [W / 2, tTB / 2, coreMidZ] },
            { size: [W - 2 * tSide, tTB, coreD], pos: [W / 2, H - tTB / 2, coreMidZ] },
            { size: [tSide, H, coreD], pos: [tSide / 2, H / 2, coreMidZ] },
            { size: [tSide, H, coreD], pos: [W - tSide / 2, H / 2, coreMidZ] },
            { size: backSize, pos: backPos },
            { size: [W, H, tFront], pos: [W / 2, H / 2, D + tFront / 2] }
        ];

        previewBoards = panels.map(p => ({
            size: p.size,
            position: [p.pos[0] + offset[0], p.pos[1] + offset[1], p.pos[2] + offset[2]]
        }));
    }

    // 3. Shelving Preview
    if (shelvingDialog) {
        const W = parseNum(shelvingDialog.width, 30);
        const H = parseNum(shelvingDialog.height, 48);
        const D = parseNum(shelvingDialog.depth, 11);
        const t = parseNum(shelvingDialog.thickness, 0.75);
        const count = parseInt(shelvingDialog.count, 10) || 3;
        let offset = [parseNum(shelvingDialog.offsetX, 0), parseNum(shelvingDialog.offsetY, 0), parseNum(shelvingDialog.offsetZ, 0)];

        const availableHeight = H - (count * t);
        const gap = availableHeight / (count + 1);

        for (let i = 0; i < count; i++) {
            const yCenter = gap * (i + 1) + t * i + (t / 2);
            previewBoards.push({
                size: [W, t, D],
                position: [W / 2 + offset[0], yCenter + offset[1], D / 2 + offset[2]]
            });
        }
    }

    // 4. Face Frame Preview
    if (faceFrameDialog) {
        const W = parseNum(faceFrameDialog.width, 24);
        const H = parseNum(faceFrameDialog.height, 30);
        const t = parseNum(faceFrameDialog.thickness, 0.75);
        const wStile = parseNum(faceFrameDialog.stileWidth, 1.5);
        const wRail = parseNum(faceFrameDialog.railWidth, 1.5);
        let offset = [parseNum(faceFrameDialog.offsetX, 0), parseNum(faceFrameDialog.offsetY, 0), parseNum(faceFrameDialog.offsetZ, 0)];

        const railW = W - (2 * wStile);
        const midZ = t / 2;

        const panels = [
            { size: [wStile, H, t], pos: [wStile / 2, H / 2, midZ] },
            { size: [wStile, H, t], pos: [W - wStile / 2, H / 2, midZ] },
            { size: [railW, wRail, t], pos: [W / 2, H - wRail / 2, midZ] },
            { size: [railW, wRail, t], pos: [W / 2, wRail / 2, midZ] }
        ];

        previewBoards = panels.map(p => ({
            size: p.size,
            position: [p.pos[0] + offset[0], p.pos[1] + offset[1], p.pos[2] + offset[2]]
        }));
    }

    // 5. Shaker Door Preview
    if (shakerDoorDialog) {
        const W = parseNum(shakerDoorDialog.width, 18);
        const H = parseNum(shakerDoorDialog.height, 30);
        const tFrame = parseNum(shakerDoorDialog.thicknessFrame, 0.75);
        const tPanel = parseNum(shakerDoorDialog.thicknessPanel, 0.25);
        const wStile = parseNum(shakerDoorDialog.widthStileRail, 2);
        const grooveD = parseNum(shakerDoorDialog.grooveDepth, 0.375);
        const clear = parseNum(shakerDoorDialog.panelClearance, 0.125);
        let offset = [parseNum(shakerDoorDialog.offsetX, 0), parseNum(shakerDoorDialog.offsetY, 0), parseNum(shakerDoorDialog.offsetZ, 0)];

        const panelW = W - 2 * wStile + 2 * grooveD - clear;
        const panelH = H - 2 * wStile + 2 * grooveD - clear;
        const railTotalW = W - 2 * wStile + 2 * grooveD;
        const midZ = tFrame / 2;

        const panels = [
            { size: [wStile, H, tFrame], pos: [wStile / 2, H / 2, midZ] },
            { size: [wStile, H, tFrame], pos: [W - wStile / 2, H / 2, midZ] },
            { size: [railTotalW, wStile, tFrame], pos: [W / 2, H - wStile / 2, midZ] },
            { size: [railTotalW, wStile, tFrame], pos: [W / 2, wStile / 2, midZ] },
            { size: [panelW, panelH, tPanel], pos: [W / 2, H / 2, midZ] }
        ];

        previewBoards = panels.map(p => ({
            size: p.size,
            position: [p.pos[0] + offset[0], p.pos[1] + offset[1], p.pos[2] + offset[2]]
        }));
    }

    if (previewBoards.length === 0) return null;

    // Glowing preview color (harmonic wood/brass hue)
    const previewColor = theme === 'dark' ? '#bc8a5f' : '#FF9500';

    return (
        <group>
            {previewBoards.map((b, idx) => (
                <group key={idx} position={b.position}>
                    {/* Glowing Wireframe */}
                    <mesh>
                        <boxGeometry args={b.size} />
                        <meshBasicMaterial 
                            color={previewColor} 
                            wireframe 
                            transparent 
                            opacity={0.65} 
                            depthWrite={false}
                        />
                    </mesh>
                    {/* Glowing Transparent Face Solid */}
                    <mesh>
                        <boxGeometry args={b.size} />
                        <meshBasicMaterial 
                            color={previewColor} 
                            transparent 
                            opacity={0.18} 
                            depthWrite={false}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
}
