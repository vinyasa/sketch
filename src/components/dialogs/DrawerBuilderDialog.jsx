import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const roundDownTo1_8 = (val) => Math.floor(val * 8) / 8;

const DrawerBuilderDialog = () => {
    const { drawerDialog: dialog, setDrawerDialog: setDialog, buildDrawers, selectedItemIds, groups, boards, units } = useStore();

    const isMetric = units === 'metric';

    const roundDownUnit = (val) => {
        if (isMetric) {
            return Math.floor(val * 25.4) / 25.4;
        }
        return Math.floor(val * 8) / 8;
    };

    const H_in = dialog ? parseNum(dialog.height, 30) : 30;
    const count = dialog ? parseInt(dialog.count ?? 3, 10) : 3;
    const gap_in = dialog ? parseNum(dialog.gap, 0.125) : 0.125;
    const verticalGap_in = gap_in;
    const totalSlotH_in = H_in - (count + 1) * gap_in;

    React.useEffect(() => {
        if (!dialog) return;
        if (!dialog.slotHeights || dialog.slotHeights.length !== count) {
            const share_in = roundDownUnit(totalSlotH_in / count);
            const initialHeights = Array(count).fill(share_in);
            setDialog(p => ({ ...p, slotHeights: initialHeights }));
        }
    }, [dialog, count]);

    if (!dialog) return null;

    const W_in = parseNum(dialog.width, 24);
    const D_in = parseNum(dialog.depth, 20);
    const slideWidth_in = parseNum(dialog.slideWidth, 0.5);
    const topClearance_in = parseNum(dialog.topClearance, 1.0);
    
    const thicknessBox_in = parseNum(dialog.thicknessBox, 0.5);
    const thicknessBottom_in = parseNum(dialog.thicknessBottom, 0.25);
    const thicknessFace_in = parseNum(dialog.thicknessFace, 0.75);
    
    const faceStyle = dialog.faceStyle ?? 'inset';
    const overlayAmount_in = parseNum(dialog.overlayAmount, 0.5);
    const reveal_in = dialog ? parseNum(dialog.reveal, 0.375) : 0.375;
    const jointType = dialog.jointType ?? 'butt';

    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const gap = isMetric ? parseFloat((gap_in * 25.4).toFixed(1)) : gap_in;
    const verticalGap = gap;
    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const D = isMetric ? parseFloat((D_in * 25.4).toFixed(1)) : D_in;
    const slideWidth = isMetric ? parseFloat((slideWidth_in * 25.4).toFixed(1)) : slideWidth_in;
    const topClearance = isMetric ? parseFloat((topClearance_in * 25.4).toFixed(1)) : topClearance_in;
    const thicknessBox = isMetric ? parseFloat((thicknessBox_in * 25.4).toFixed(1)) : thicknessBox_in;
    const thicknessBottom = isMetric ? parseFloat((thicknessBottom_in * 25.4).toFixed(1)) : thicknessBottom_in;
    const thicknessFace = isMetric ? parseFloat((thicknessFace_in * 25.4).toFixed(1)) : thicknessFace_in;
    const overlayAmount = isMetric ? parseFloat((overlayAmount_in * 25.4).toFixed(1)) : overlayAmount_in;
    const reveal = isMetric ? parseFloat((reveal_in * 25.4).toFixed(1)) : reveal_in;

    const fmt = (v) => v.toFixed(v % 1 === 0 ? 0 : (isMetric ? 1 : 3));
    const unitLabel = isMetric ? 'mm' : '"';
    const unitFmtLabel = isMetric ? 'mm' : 'in';
    const roundDownDisplay = (val) => {
        if (isMetric) {
            return Math.floor(val);
        }
        return Math.floor(val * 8) / 8;
    };

    // Detect if a cabinet is selected in the workspace
    let cabinetId = selectedItemIds?.find(id => groups[id]?.meta?.builder === 'cabinet');
    let cabinetBoardSelected = dialog?.cabinetBoardSelected || false;
    let parentCabinetName = '';
    if (!cabinetId) {
        selectedItemIds?.forEach(id => {
            const board = boards?.find(b => b.id.toString() === id.toString());
            if (board && groups[board.parentId]?.meta?.builder === 'cabinet') {
                cabinetBoardSelected = true;
                parentCabinetName = groups[board.parentId].name || 'Cabinet';
            }
        });
    }

    const selectedCabinet = cabinetId ? groups[cabinetId] : null;
    let tSide = 0.75;
    let tTB = 0.75;
    if (selectedCabinet) {
        const cabParams = selectedCabinet.meta?.params || {};
        tSide = parseNum(cabParams.thicknessSide, 0.75);
        tTB = parseNum(cabParams.thicknessTB, 0.75);
    }
    
    let slotHeights_in = dialog.slotHeights || [];
    if (slotHeights_in.length !== count) {
        const share_in = roundDownUnit(totalSlotH_in / count);
        slotHeights_in = Array(count).fill(share_in);
    }

    const slotHeights = isMetric ? slotHeights_in.map(h => parseFloat((h * 25.4).toFixed(1))) : slotHeights_in;

    const roundedSlotHeights_in = slotHeights_in.map(roundDownUnit);
    const leftoverGap_in = H_in - roundedSlotHeights_in.reduce((s, v) => s + v, 0) - count * gap_in;
    const leftoverGap = isMetric ? leftoverGap_in * 25.4 : leftoverGap_in;

    const boxW_in = W_in - 2 * slideWidth_in;
    const defaultBoxDepth_in = isMetric
        ? Math.max(100, Math.floor(((D_in * 25.4) - 25) / 50) * 50) / 25.4
        : Math.max(2, Math.floor((D_in - 1.0) / 2) * 2);
    const boxD_in = parseNum(dialog.boxDepth, defaultBoxDepth_in);
    const faceW_in = faceStyle === 'inset' ? W_in - 2 * gap_in : W_in + 2 * (tSide - reveal_in);
    
    const boxW = isMetric ? boxW_in * 25.4 : boxW_in;
    const defaultBoxDepth = isMetric ? defaultBoxDepth_in * 25.4 : defaultBoxDepth_in;
    const boxD = isMetric ? boxD_in * 25.4 : boxD_in;
    const faceW = isMetric ? faceW_in * 25.4 : faceW_in;

    const valid = W_in > 2 * slideWidth_in + 2 * thicknessBox_in &&
                  count > 0 &&
                  leftoverGap_in >= -0.0001 &&
                  boxD_in > 0 &&
                  boxD_in <= D_in &&
                  slotHeights_in.every(h => h - topClearance_in > (isMetric ? 12.5 / 25.4 : 0.5));

    let cabOpeningWidth_in = 0;
    let cabOpeningHeight_in = 0;
    let cabOpeningDepth_in = 0;
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
        
        const cabW_in = parseNum(cabParams.width, 24);
        const cabH_in = parseNum(cabParams.height, 30);
        const cabD_in = parseNum(cabParams.depth, 14);
        const cabtTB_in = parseNum(cabParams.thicknessTB, 0.75);
        const cabtSide_in = parseNum(cabParams.thicknessSide, 0.75);
        const cabtBack_in = parseNum(cabParams.thicknessBack, 0.25);
        const cabCoreDepth_in = cabD_in - cabtBack_in;
        
        cabOpeningWidth_in = cabW_in - 2 * cabtSide_in;
        cabOpeningHeight_in = cabH_in - 2 * cabtTB_in;
        cabOpeningDepth_in = cabCoreDepth_in;

        cabOpeningWidth = isMetric ? parseFloat((cabOpeningWidth_in * 25.4).toFixed(1)) : cabOpeningWidth_in;
        cabOpeningHeight = isMetric ? parseFloat((cabOpeningHeight_in * 25.4).toFixed(1)) : cabOpeningHeight_in;
        cabOpeningDepth = isMetric ? parseFloat((cabOpeningDepth_in * 25.4).toFixed(1)) : cabOpeningDepth_in;
        
        willFit = W_in <= cabOpeningWidth_in + 0.01 && H_in <= cabOpeningHeight_in + 0.01 && D_in <= cabOpeningDepth_in + 0.01;
    }

    const useCabinetDimensions = () => {
        if (!selectedCabinet) return;
        setDialog(prev => ({
            ...prev,
            width: cabOpeningWidth_in,
            height: cabOpeningHeight_in,
            depth: cabOpeningDepth_in
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
            width: W_in,
            height: H_in,
            depth: D_in,
            count: count,
            slideWidth: slideWidth_in,
            gap: gap_in,
            reveal: reveal_in,
            verticalGap: verticalGap_in,
            topClearance: topClearance_in,
            thicknessBox: thicknessBox_in,
            thicknessBottom: thicknessBottom_in,
            thicknessFace: thicknessFace_in,
            faceStyle: faceStyle,
            overlayAmount: overlayAmount_in,
            jointType: jointType,
            boxDepth: boxD_in,
            slotHeights: slotHeights_in
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

                {/* Selection Detection Banner */}
                {isCabinetSelected ? (
                    willFit ? (
                        <div style={{
                            padding: '10px 12px',
                            background: 'rgba(52, 199, 89, 0.1)',
                            border: '1px dashed rgba(52, 199, 89, 0.4)',
                            borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                            lineHeight: 1.4
                        }}>
                            <strong>✓ Cabinet Group Selected ("{cabName}")</strong><br/>
                            The drawer stack is pre-populated to fit perfectly inside the selected cabinet's opening ({fmt(cabOpeningWidth)}{unitLabel} × {fmt(cabOpeningHeight)}{unitLabel} × {fmt(cabOpeningDepth)}{unitLabel}).
                            {(Math.abs(W - cabOpeningWidth) > 0.01 || Math.abs(H - cabOpeningHeight) > 0.01 || Math.abs(D - cabOpeningDepth) > 0.01) && (
                                <div style={{ marginTop: '6px' }}>
                                    <span 
                                        style={{ color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                                        onClick={useCabinetDimensions}
                                    >
                                        Snap to Full Opening ({fmt(cabOpeningWidth)}{unitLabel} × {fmt(cabOpeningHeight)}{unitLabel} × {fmt(cabOpeningDepth)}{unitLabel})
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            padding: '10px 12px',
                            background: 'rgba(255, 59, 48, 0.1)',
                            border: '1px dashed rgba(255, 59, 48, 0.4)',
                            borderRadius: '8px', fontSize: '0.75rem', color: '#ff3b30',
                            lineHeight: 1.4
                        }}>
                            <strong>⚠ Cabinet Fit Warning ("{cabName}")</strong><br/>
                            Configured drawer dimensions ({fmt(W)}{unitLabel} × {fmt(H)}{unitLabel} × {fmt(D)}{unitLabel}) exceed the selected cabinet opening of {fmt(cabOpeningWidth)}{unitLabel} × {fmt(cabOpeningHeight)}{unitLabel} × {fmt(cabOpeningDepth)}{unitLabel}.
                            <div style={{ marginTop: '6px' }}>
                                <button 
                                    className="nav-btn" 
                                    style={{ padding: '3px 8px', fontSize: '0.72rem', borderColor: 'var(--accent-color)', cursor: 'pointer' }}
                                    onClick={useCabinetDimensions}
                                >
                                    👉 Auto-fit to Cabinet Opening ({fmt(cabOpeningWidth)}{unitLabel} × {fmt(cabOpeningHeight)}{unitLabel} × {fmt(cabOpeningDepth)}{unitLabel})
                                </button>
                            </div>
                        </div>
                    )
                ) : null}
                {cabinetBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 149, 0, 0.1)',
                        border: '1px dashed rgba(255, 149, 0, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#ff9500',
                        lineHeight: 1.4
                    }}>
                        <strong>⚠ Single Board Selected ("{parentCabinetName}")</strong><br/>
                        You selected a board belonging to a cabinet, but not the entire cabinet group. To automatically fit this drawer stack, close this builder, select the <strong>Cabinet</strong> group in the tree or double-click it, and try again.
                    </div>
                )}
                {!isCabinetSelected && !cabinetBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Cabinet selected.</strong><br/>
                        Building a standalone drawer stack. You can input custom dimensions directly below.<br/>
                        <span style={{ display: 'block', marginTop: '6px', color: 'var(--accent-color)', fontWeight: 'bold' }}>💡 Tip: To auto-fit, close this builder, select the entire Cabinet group in the tree, and try again.</span>
                    </div>
                )}


                {/* Overall Opening Dimensions */}
                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Cabinet Opening ({unitFmtLabel})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={W}
                                onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Height (Y)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={H}
                                onChange={val => setDialog(p => ({ ...p, height: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Depth (Z)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={D}
                                onChange={val => setDialog(p => ({ ...p, depth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>
                        The clear interior opening of the cabinet where drawers will be installed.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '110px' }}>Drawer Box Depth:</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" max={D} value={boxD}
                                onChange={val => setDialog(p => ({ ...p, boxDepth: isMetric ? val / 25.4 : val }))}
                                style={{ ...inputStyle, flex: 1, padding: '3px 8px', borderColor: boxD > D ? '#ff3b30' : 'var(--border-color)' }} />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unitLabel}</span>
                        </div>
                        <p className="hint" style={{ marginTop: '2px', color: boxD > D ? '#ff3b30' : 'var(--text-muted)', fontSize: '0.68rem', lineHeight: 1.3, margin: 0 }}>
                            {boxD > D 
                                ? `⚠️ Value cannot exceed cabinet depth (${fmt(D)}${unitLabel}).`
                                : isMetric 
                                    ? `Note: Slides are typically even numbers in 50mm increments. Defaults to ${fmt(defaultBoxDepth)}${unitLabel} (longest length at least 25mm shorter than cabinet).`
                                    : `Note: Slides are typically even numbers in 2" increments. Defaults to ${defaultBoxDepth}" (longest even length at least 1" shorter than cabinet).`
                            }
                        </p>
                    </div>
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
                                <div style={labelStyle}>Reveal around Cabinet ({unitLabel})</div>
                                <NumericInput step={isMetric ? "1" : "0.0625"} min="0" value={reveal}
                                    onChange={val => setDialog(p => ({ ...p, reveal: isMetric ? val / 25.4 : val }))}
                                    style={inputStyle} title="Space all around the drawer set relative to carcass edges" />
                            </div>
                        )}
                        <div>
                            <div style={labelStyle}>{faceStyle === 'overlay' ? `Spacing Gap (${unitLabel})` : `Gap (${unitLabel})`}</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min="0" value={gap}
                                onChange={val => setDialog(p => ({ ...p, gap: isMetric ? val / 25.4 : val }))}
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
                            <div style={labelStyle}>Slide Width ({unitLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.125"} min="0" value={slideWidth}
                                onChange={val => setDialog(p => ({ ...p, slideWidth: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} title="Clearance on each side for the slide hardware" />
                        </div>
                        <div>
                            <div style={labelStyle}>Box Top Clear. ({unitLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.125"} min="0" value={topClearance}
                                onChange={val => setDialog(p => ({ ...p, topClearance: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} title="Clearance above the drawer box to the slot ceiling" />
                        </div>
                    </div>
                </div>

                {/* Individual Drawer Heights */}
                {count > 0 && (
                    <div className="inspector-card" style={{ margin: 0 }}>
                        <h4>Individual Drawer Spacings & Sizes ({unitFmtLabel})</h4>
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

                                // Sizing calculations
                                const rBoxW = roundDownDisplay(boxW);
                                const rBoxD = boxD;
                                const rBoxH = roundDownDisplay(computedBoxH);
                                
                                const rFaceW = roundDownDisplay(fW);
                                const rFaceH = roundDownDisplay(faceH);

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
                                                <NumericInput
                                                    step={isMetric ? "5" : "0.125"}
                                                    min="1.0"
                                                    value={parseFloat(sH.toFixed(1))}
                                                    onChange={val => {
                                                        const newVal = val;
                                                        if (isNaN(newVal) || newVal <= 0) return;
                                                        const nextHeights_in = [...slotHeights_in];
                                                        nextHeights_in[idx] = isMetric ? newVal / 25.4 : newVal;
                                                        setDialog(p => ({ ...p, slotHeights: nextHeights_in }));
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
                                                    {fmt(rBoxW)}{unitLabel} × {fmt(rBoxD)}{unitLabel} × {rBoxH >= (isMetric ? 12.7 : 0.5) ? `${fmt(rBoxH)}${unitLabel}` : 'Too small!'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>🖼️ Face:</span>{' '}
                                                <strong style={{ color: 'var(--text-main)' }}>
                                                    {fmt(rFaceW)}{unitLabel} × {fmt(rFaceH)}{unitLabel}
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
                                        {fmt(leftoverGap)}{unitLabel}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                    {leftoverGap >= -0.0001 ? (
                                        `Calculated bottom reveal: includes the unified spacing gap (${fmt(gap)}${unitLabel}) plus the leftover space (${fmt(leftoverGap - gap)}${unitLabel}) from rounding or unfilled height.`
                                    ) : (
                                        <span style={{ color: '#ff3b30', fontWeight: '500' }}>
                                            Illegal negative gap! Spacings exceed available cabinet height by {fmt(Math.abs(leftoverGap))}{unitLabel}. Building drawers is blocked.
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
                    <h4>Material Thickness ({unitFmtLabel})</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Box Sides</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min={isMetric ? "3" : "0.125"} value={thicknessBox}
                                onChange={val => setDialog(p => ({ ...p, thicknessBox: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Bottom Panel</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min={isMetric ? "3" : "0.125"} value={thicknessBottom}
                                onChange={val => setDialog(p => ({ ...p, thicknessBottom: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Drawer Face</div>
                            <NumericInput step={isMetric ? "1" : "0.0625"} min={isMetric ? "3" : "0.125"} value={thicknessFace}
                                onChange={val => setDialog(p => ({ ...p, thicknessFace: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                </div>



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
                            <div><strong>Drawer Box Width:</strong> {fmt(roundDownDisplay(boxW))}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>({isMetric ? 'rounded down to nearest mm' : 'rounded down to nearest 1/8"'}, fits opening width {fmt(W)}{unitLabel} with slide clearance {fmt(slideWidth)}{unitLabel} × 2)</span></div>
                            <div><strong>Drawer Box Depth:</strong> {fmt(boxD)}{unitLabel} <span style={{ color: 'var(--text-muted)' }}>({boxD === defaultBoxDepth ? 'default length' : 'custom length'})</span></div>
                            <div style={{ marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                                <strong>Individual Drawer Box Heights ({isMetric ? 'Rounded down to nearest mm' : 'Rounded down to nearest 1/8"'}):</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px', paddingLeft: '8px' }}>
                                    {slotHeights.map((sH, i) => {
                                        const computedBoxH = sH - topClearance;
                                        return (
                                            <div key={i}>
                                                · Drawer {i+1} Box: <strong>{fmt(roundDownDisplay(computedBoxH))}{unitLabel}</strong> high <span style={{ color: 'var(--text-muted)' }}>(slot spacing: {fmt(sH)}{unitLabel})</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            {boxD > D ? (
                                `Drawer box depth (${fmt(boxD)}${unitLabel}) cannot exceed cabinet depth (${fmt(D)}${unitLabel}).`
                            ) : (
                                `Invalid drawer specs. Ensure cabinet opening width can accommodate slides & box sides, and calculated box heights are at least 0.50".`
                            )}
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
