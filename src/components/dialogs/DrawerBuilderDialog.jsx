import React from 'react';
import useStore from '../../store/useStore';

const roundDownTo1_8 = (val) => Math.floor(val * 8) / 8;

const DrawerBuilderDialog = () => {
    const { drawerDialog: dialog, setDrawerDialog: setDialog, buildDrawers, selectedItemIds, groups, boards } = useStore();

    const parse = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };
    const H = dialog ? parse(dialog.height, 30) : 30;
    const count = dialog ? parseInt(dialog.count ?? 3, 10) : 3;
    const gap = dialog ? parse(dialog.gap, 0.125) : 0.125;
    const verticalGap = gap;
    const totalSlotH = H - (count + 1) * gap;

    React.useEffect(() => {
        if (!dialog) return;
        if (!dialog.slotHeights || dialog.slotHeights.length !== count) {
            const share = roundDownTo1_8(totalSlotH / count);
            const initialHeights = Array(count).fill(share);
            setDialog(p => ({ ...p, slotHeights: initialHeights }));
        }
    }, [dialog, count]);

    if (!dialog) return null;

    const W = parse(dialog.width, 24);
    const D = parse(dialog.depth, 20);
    const slideWidth = parse(dialog.slideWidth, 0.5);
    const topClearance = parse(dialog.topClearance, 1.0);
    
    const thicknessBox = parse(dialog.thicknessBox, 0.5);
    const thicknessBottom = parse(dialog.thicknessBottom, 0.25);
    const thicknessFace = parse(dialog.thicknessFace, 0.75);
    
    const faceStyle = dialog.faceStyle ?? 'inset';
    const overlayAmount = parse(dialog.overlayAmount, 0.5);
    const reveal = dialog ? parse(dialog.reveal, 0.375) : 0.375;
    const jointType = dialog.jointType ?? 'butt';

    // Detect if a cabinet is selected in the workspace
    let cabinetId = selectedItemIds?.find(id => groups[id]?.meta?.builder === 'cabinet');
    if (!cabinetId) {
        selectedItemIds?.forEach(id => {
            const board = boards?.find(b => b.id.toString() === id.toString());
            if (board && groups[board.parentId]?.meta?.builder === 'cabinet') {
                cabinetId = board.parentId;
            }
        });
    }

    const selectedCabinet = cabinetId ? groups[cabinetId] : null;
    let tSide = 0.75;
    let tTB = 0.75;
    if (selectedCabinet) {
        const cabParams = selectedCabinet.meta?.params || {};
        tSide = parse(cabParams.thicknessSide, 0.75);
        tTB = parse(cabParams.thicknessTB, 0.75);
    }
    
    let slotHeights = dialog.slotHeights || [];
    if (slotHeights.length !== count) {
        const share = roundDownTo1_8(totalSlotH / count);
        slotHeights = Array(count).fill(share);
    }

    const roundedSlotHeights = slotHeights.map(roundDownTo1_8);
    const leftoverGap = H - roundedSlotHeights.reduce((s, v) => s + v, 0) - count * gap;

    const boxW = W - 2 * slideWidth;
    const boxD = faceStyle === 'inset' ? D - thicknessFace - 1.0 : D - 1.0;
    const faceW = faceStyle === 'inset' ? W - 2 * gap : W + 2 * (tSide - reveal);
    const valid = W > 2 * slideWidth + 2 * thicknessBox &&
                  count > 0 &&
                  leftoverGap >= -0.0001 &&
                  slotHeights.every(h => h - topClearance > 0.5);
    let cabOpeningWidth = 0;
    let cabOpeningHeight = 0;
    let cabOpeningDepth = 0;
    let cabName = '';
    let isCabinetSelected = false;
    let willFit = false;

    if (selectedCabinet) {
        isCabinetSelected = true;
        cabName = selectedCabinet.name || cabinetId;
        const cabParams = selectedCabinet.meta?.params || {};
        
        const cabW = parse(cabParams.width, 24);
        const cabH = parse(cabParams.height, 30);
        const cabD = parse(cabParams.depth, 14);
        const cabtTB = parse(cabParams.thicknessTB, 0.75);
        const cabtSide = parse(cabParams.thicknessSide, 0.75);
        const cabtBack = parse(cabParams.thicknessBack, 0.25);
        const cabCoreDepth = cabD - cabtBack;
        
        cabOpeningWidth = cabW - 2 * cabtSide;
        cabOpeningHeight = cabH - 2 * cabtTB;
        cabOpeningDepth = cabCoreDepth;
        
        willFit = W <= cabOpeningWidth + 0.01 && H <= cabOpeningHeight + 0.01 && D <= cabOpeningDepth + 0.01;
    }

    const useCabinetDimensions = () => {
        if (!selectedCabinet) return;
        setDialog(prev => ({
            ...prev,
            width: cabOpeningWidth,
            height: cabOpeningHeight,
            depth: cabOpeningDepth
        }));
    };

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const handleBuild = () => {
        if (!valid) return;
        const fullCfg = {
            ...dialog,
            width: W,
            height: H,
            depth: D,
            count: count,
            slideWidth: slideWidth,
            gap: gap,
            reveal: reveal,
            verticalGap: verticalGap,
            topClearance: topClearance,
            thicknessBox: thicknessBox,
            thicknessBottom: thicknessBottom,
            thicknessFace: thicknessFace,
            faceStyle: faceStyle,
            overlayAmount: overlayAmount,
            jointType: jointType,
            slotHeights: slotHeights
        };
        buildDrawers(fullCfg);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '480px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🗃️</span> Drawer Builder
                </h2>

                {/* Overall Opening Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Cabinet Opening (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <input type="number" step="0.5" min="1" value={W}
                                onChange={e => setDialog(p => ({ ...p, width: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <input type="number" step="0.5" min="1" value={H}
                                onChange={e => setDialog(p => ({ ...p, height: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Depth (Z)</div>
                            <input type="number" step="0.5" min="1" value={D}
                                onChange={e => setDialog(p => ({ ...p, depth: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        The clear interior opening of the cabinet where drawers will be installed.
                    </p>
                </div>

                {/* Drawer Face Styling */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Drawer Face Styling</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: faceStyle === 'overlay' ? '1.2fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Face Style</div>
                            <select
                                value={faceStyle}
                                onChange={e => setDialog(p => ({ ...p, faceStyle: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="inset">Inset (Flush with frame)</option>
                                <option value="overlay">Overlay (Proud of frame)</option>
                            </select>
                        </div>
                        {faceStyle === 'overlay' && (
                            <div>
                                <div style={labelStyle}>Reveal around Cabinet</div>
                                <input type="number" step="0.0625" min="0" value={reveal}
                                    onChange={e => setDialog(p => ({ ...p, reveal: e.target.value }))}
                                    style={inputStyle} title="Space all around the drawer set relative to carcass edges" />
                            </div>
                        )}
                        <div>
                            <div style={labelStyle}>{faceStyle === 'overlay' ? 'Spacing Gap' : 'Gap (in)'}</div>
                            <input type="number" step="0.0625" min="0" value={gap}
                                onChange={e => setDialog(p => ({ ...p, gap: e.target.value }))}
                                style={inputStyle} title={faceStyle === 'overlay' ? 'Spacing gap between drawer faces' : 'Perimeter spacing gap around drawer faces'} />
                        </div>
                    </div>
                </div>

                {/* Drawer Configuration */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Drawer Configuration</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <div style={labelStyle}>Number of Drawers</div>
                            <input type="number" step="1" min="1" max="10" value={count}
                                onChange={e => setDialog(p => ({ ...p, count: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Corner Joint Type</div>
                            <select
                                value={jointType}
                                onChange={e => setDialog(p => ({ ...p, jointType: e.target.value }))}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="butt">Butt (Sides capture F/B)</option>
                                <option value="rabbet">Rabbeted Sides</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Slide Width</div>
                            <input type="number" step="0.125" min="0" value={slideWidth}
                                onChange={e => setDialog(p => ({ ...p, slideWidth: e.target.value }))}
                                style={inputStyle} title="Clearance on each side for the slide hardware" />
                        </div>
                        <div>
                            <div style={labelStyle}>Box Top Clear.</div>
                            <input type="number" step="0.125" min="0" value={topClearance}
                                onChange={e => setDialog(p => ({ ...p, topClearance: e.target.value }))}
                                style={inputStyle} title="Clearance above the drawer box to the slot ceiling" />
                        </div>
                    </div>
                </div>

                {/* Individual Drawer Heights */}
                {count > 0 && (
                    <div className="inspector-card" style={{ margin: 0 }}>
                        <h4>Individual Drawer Spacings & Sizes (in)</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {slotHeights.map((sH, idx) => {
                                const computedBoxH = sH - topClearance;
                                
                                // Calculate individual drawer face height
                                let faceH = sH;
                                let fW = faceStyle === 'inset' ? W - 2 * gap : W + 2 * (tSide - reveal);
                                if (faceStyle === 'inset') {
                                    faceH = sH;
                                } else {
                                    const overallH = H + 2 * tTB;
                                    const totalFaceSpace = overallH - 2 * reveal;
                                    const totalGaps = (count - 1) * gap;
                                    const totalFaceHeightsSum = totalFaceSpace - totalGaps;
                                    const sumSlotH = slotHeights.reduce((s, h) => s + h, 0);
                                    faceH = sumSlotH > 0 ? sH * (totalFaceHeightsSum / sumSlotH) : 0;
                                }

                                // Sizing calculations (rounded down to nearest 1/8")
                                const rBoxW = roundDownTo1_8(boxW);
                                const rBoxD = roundDownTo1_8(boxD);
                                const rBoxH = roundDownTo1_8(computedBoxH);
                                
                                const rFaceW = roundDownTo1_8(fW);
                                const rFaceH = roundDownTo1_8(faceH);

                                return (
                                    <div key={idx} style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '8px',
                                        padding: '10px',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 'bold', width: '70px', color: 'var(--text-main)' }}>
                                                Drawer {idx + 1}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={labelStyle}>Slot Height</div>
                                                <input
                                                    type="number"
                                                    step="0.125"
                                                    min="1.0"
                                                    value={parseFloat(sH.toFixed(4))}
                                                    onChange={e => {
                                                        const newVal = parseFloat(e.target.value);
                                                        if (isNaN(newVal) || newVal <= 0) return;
                                                        const nextHeights = [...slotHeights];
                                                        nextHeights[idx] = newVal;
                                                        setDialog(p => ({ ...p, slotHeights: nextHeights }));
                                                    }}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* Drawer Rounded Box & Face Dimensions */}
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: '1fr 1fr', 
                                            gap: '6px 12px',
                                            background: 'rgba(0,0,0,0.15)',
                                            padding: '6px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-muted)'
                                        }}>
                                            <div>
                                                <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>📦 Box:</span>{' '}
                                                <strong style={{ color: 'var(--text-main)' }}>
                                                    {rBoxW.toFixed(3)}" × {rBoxD.toFixed(3)}" × {rBoxH >= 0.5 ? `${rBoxH.toFixed(3)}"` : 'Too small!'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>🖼️ Face:</span>{' '}
                                                <strong style={{ color: 'var(--text-main)' }}>
                                                    {rFaceW.toFixed(3)}" × {rFaceH.toFixed(3)}"
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Bottom Gap Card in the List */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '6px',
                                padding: '12px',
                                background: leftoverGap >= -0.0001 ? 'rgba(52, 199, 89, 0.04)' : 'rgba(255, 59, 48, 0.05)', 
                                border: leftoverGap >= -0.0001 ? '1px dashed rgba(52, 199, 89, 0.3)' : '1px solid rgba(255, 59, 48, 0.4)', 
                                borderRadius: '8px',
                                marginTop: '4px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ 
                                        fontSize: '0.8rem', 
                                        fontWeight: 'bold', 
                                        color: leftoverGap >= -0.0001 ? '#34c759' : '#ff3b30', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px' 
                                    }}>
                                        <span>{leftoverGap >= -0.0001 ? '🟢' : '🔴'}</span>
                                        <span>{leftoverGap >= -0.0001 ? 'Final Bottom Gap' : 'Spacing Error (Negative Gap)'}</span>
                                    </div>
                                    <span style={{ 
                                        fontSize: '1rem', 
                                        fontWeight: 'bold', 
                                        color: leftoverGap >= -0.0001 ? 'var(--text-main)' : '#ff3b30' 
                                    }}>
                                        {leftoverGap.toFixed(3)}"
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                    {leftoverGap >= -0.0001 ? (
                                        `Calculated bottom reveal: includes the unified spacing gap (${gap.toFixed(3)}") plus the leftover space (${(leftoverGap - gap).toFixed(3)}") from rounding or unfilled height.`
                                    ) : (
                                        <span style={{ color: '#ff3b30', fontWeight: '500' }}>
                                            Illegal negative gap! Spacings exceed available cabinet height by {Math.abs(leftoverGap).toFixed(3)}". Building drawers is blocked.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <p className="hint" style={{ marginTop: '6px' }}>
                            Altering a drawer height shifts only the leftover gap. If the gap goes negative, building drawers will be blocked.
                        </p>
                    </div>
                )}

                {/* Material Thickness */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Material Thickness (in)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Box Sides</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessBox}
                                onChange={e => setDialog(p => ({ ...p, thicknessBox: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Bottom Panel</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessBottom}
                                onChange={e => setDialog(p => ({ ...p, thicknessBottom: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Drawer Face</div>
                            <input type="number" step="0.0625" min="0.125" value={thicknessFace}
                                onChange={e => setDialog(p => ({ ...p, thicknessFace: e.target.value }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Cabinet Fit Acknowledgement */}
                {isCabinetSelected && (
                    <div className="inspector-card" style={{
                        margin: 0,
                        background: willFit ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)',
                        border: willFit ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)',
                    }}>
                        <h4 style={{ color: willFit ? '#34c759' : '#ff3b30', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            {willFit ? '✓ Cabinet Fit Confirmed' : '⚠ Cabinet Fit Warning'}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '6px', lineHeight: 1.5 }}>
                            {willFit ? (
                                <>
                                    These drawers are configured to fit inside the selected cabinet <strong>{cabName}</strong>.
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Cabinet Opening: {cabOpeningWidth}" × {cabOpeningHeight}" × {cabOpeningDepth}"</span>
                                        {(Math.abs(W - cabOpeningWidth) > 0.01 || Math.abs(H - cabOpeningHeight) > 0.01 || Math.abs(D - cabOpeningDepth) > 0.01) && (
                                            <span 
                                                style={{ color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline' }}
                                                onClick={useCabinetDimensions}
                                            >
                                                Snap to Full Opening
                                            </span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    Configured drawer dimensions ({W}" × {H}" × {D}") exceed the selected cabinet <strong>{cabName}</strong> opening of {cabOpeningWidth}" × {cabOpeningHeight}" × {cabOpeningDepth}".
                                    <div style={{ marginTop: '6px' }}>
                                        <button 
                                            className="nav-btn" 
                                            style={{ padding: '3px 8px', fontSize: '0.72rem', borderColor: 'var(--accent-color)', cursor: 'pointer' }}
                                            onClick={useCabinetDimensions}
                                        >
                                            👉 Auto-fit to Cabinet Opening ({cabOpeningWidth}" × {cabOpeningHeight}" × {cabOpeningDepth}")
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Drawer Summary Box */}
                <div className="inspector-card" style={{
                    margin: 0,
                    background: valid ? 'rgba(60,200,90,0.06)' : 'rgba(255,59,48,0.06)',
                    border: valid ? '1px solid rgba(60,200,90,0.2)' : '1px solid rgba(255,59,48,0.3)',
                }}>
                    <h4 style={{ color: valid ? '#34c759' : '#ff3b30' }}>
                        {valid ? '✓ Calculated Drawer Box Sizes' : '⚠ Invalid Dimensions'}
                    </h4>
                    {valid ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                            <div><strong>Drawer Box Width:</strong> {roundDownTo1_8(boxW).toFixed(3)}" <span style={{ color: 'var(--text-muted)' }}>(rounded down to nearest 1/8", fits opening width {W}" with slide clearance {slideWidth}" × 2)</span></div>
                            <div><strong>Drawer Box Depth:</strong> {roundDownTo1_8(boxD).toFixed(3)}" <span style={{ color: 'var(--text-muted)' }}>({faceStyle === 'inset' ? `inset style: opening depth ${D}" - face thickness ${thicknessFace}" - 1" back gap` : `overlay style: opening depth ${D}" - 1" back gap`})</span></div>
                            <div style={{ marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                                <strong>Individual Drawer Box Heights (Rounded down to nearest 1/8"):</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px', paddingLeft: '8px' }}>
                                    {slotHeights.map((sH, i) => {
                                        const computedBoxH = sH - topClearance;
                                        return (
                                            <div key={i}>
                                                · Drawer {i+1} Box: <strong>{roundDownTo1_8(computedBoxH).toFixed(3)}"</strong> high <span style={{ color: 'var(--text-muted)' }}>(slot spacing: {sH.toFixed(3)}")</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            Invalid drawer specs. Ensure cabinet opening width can accommodate slides & box sides, and calculated box heights are at least 0.50".
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="nav-btn" style={{ flex: 1, padding: '10px' }}
                        onClick={() => setDialog(null)}>
                        Cancel
                    </button>
                    <button className="primary-btn" style={{
                        flex: 1, padding: '10px',
                        opacity: valid ? 1 : 0.4,
                        cursor: valid ? 'pointer' : 'default',
                    }}
                        disabled={!valid}
                        onClick={handleBuild}>
                        {dialog.editGroupId ? 'Update Drawers' : 'Build Drawers'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrawerBuilderDialog;
