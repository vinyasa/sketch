import React from 'react';
import useStore from '../../store/useStore';
import { parseNum } from '../../utils/units';
import NumericInput from '../NumericInput';

const ShelvingBuilderDialog = () => {
    const { shelvingDialog: dialog, setShelvingDialog: setDialog, buildShelving, groups, units } = useStore();
    if (!dialog) return null;

    const isMetric = units === 'metric';

    const cabinetGroupId = dialog.cabinetGroupId;
    const boxGroupId = dialog.boxGroupId;
    const hasParent = !!cabinetGroupId || !!boxGroupId;
    const parentName = cabinetGroupId 
        ? (groups[cabinetGroupId]?.name || 'Selected Cabinet') 
        : (boxGroupId 
            ? (groups[boxGroupId]?.name || 'Selected Box') 
            : (dialog.parentCabinetName || dialog.parentBoxName || ''));

    const parseIntSafe = (v, def) => { const n = parseInt(v, 10); return isNaN(n) ? def : n; };

    const W_in = parseNum(dialog.width, 30);
    const H_in = parseNum(dialog.height, 48);
    const D_in = parseNum(dialog.depth, 11);
    const t_in = parseNum(dialog.thickness, 0.75);
    const count = parseIntSafe(dialog.count, 3);

    const W = isMetric ? parseFloat((W_in * 25.4).toFixed(1)) : W_in;
    const H = isMetric ? parseFloat((H_in * 25.4).toFixed(1)) : H_in;
    const D = isMetric ? parseFloat((D_in * 25.4).toFixed(1)) : D_in;
    const t = isMetric ? parseFloat((t_in * 25.4).toFixed(1)) : t_in;

    const valid = W_in > 0 && H_in > (count * t_in) && D_in > 0 && count > 0;

    const inputStyle = {
        width: '100%', padding: '5px 8px',
        background: 'var(--bg-color)', color: 'var(--text-main)',
        border: '1px solid var(--border-color)', borderRadius: '6px',
        outline: 'none', fontSize: '0.9rem',
    };

    const labelStyle = {
        fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px',
    };

    const unitFmtLabel = isMetric ? 'mm' : 'in';

    const handleBuild = () => {
        if (!valid) return;
        if (buildShelving) buildShelving(dialog);
        setDialog(null);
    };

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            position: 'fixed', inset: 0,
        }} onClick={() => setDialog(null)}>
            <div className="glass-panel" style={{
                padding: '24px', width: '440px', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', gap: '16px',
                maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📚</span> {dialog.editGroupId ? 'Edit Shelving' : 'Parametric Shelving'}
                </h2>

                {/* Parent Detection Banner */}
                {hasParent && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(52, 199, 89, 0.1)',
                        border: '1px dashed rgba(52, 199, 89, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#34c759',
                        lineHeight: 1.4
                    }}>
                        <strong>✓ Parent Group Selected ("{parentName}")</strong><br/>
                        The shelves will be placed and auto-sized precisely to fit the internal opening of the selected {cabinetGroupId ? 'cabinet' : 'box'}.
                    </div>
                )}
                {dialog.cabinetBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 149, 0, 0.1)',
                        border: '1px dashed rgba(255, 149, 0, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#ff9500',
                        lineHeight: 1.4
                    }}>
                        <strong>⚠ Single Board Selected (Cabinet)</strong><br/>
                        You selected a board belonging to a cabinet, but not the entire cabinet group. To automatically fit these shelves, close this builder, select the <strong>Cabinet</strong> group in the tree or double-click it, and try again.
                    </div>
                )}
                {dialog.boxBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(255, 149, 0, 0.1)',
                        border: '1px dashed rgba(255, 149, 0, 0.4)',
                        borderRadius: '8px', fontSize: '0.75rem', color: '#ff9500',
                        lineHeight: 1.4
                    }}>
                        <strong>⚠ Single Board Selected (Box)</strong><br/>
                        You selected a board belonging to a box, but not the entire box group. To automatically fit these shelves, close this builder, select the <strong>Box</strong> group in the tree or double-click it, and try again.
                    </div>
                )}
                {!hasParent && !dialog.cabinetBoardSelected && !dialog.boxBoardSelected && (
                    <div style={{
                        padding: '10px 12px',
                        background: 'rgba(188, 138, 95, 0.08)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)',
                        lineHeight: 1.4
                    }}>
                        <strong>No Cabinet or Box selected.</strong><br/>
                        Building standalone shelving. You can input custom dimensions directly below.<br/>
                        <span style={{ display: 'block', marginTop: '6px', color: 'var(--accent-color)', fontWeight: 'bold' }}>💡 Tip: To auto-fit, close this builder, select the entire Cabinet or Box group in the tree, and try again.</span>
                    </div>
                )}

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Opening Dimensions ({unitFmtLabel})</h4>
                    <p className="hint" style={{ marginTop: '2px', marginBottom: '8px' }}>
                        The internal width, depth, and total vertical height to distribute shelves across.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Width (X)</div>
                            <NumericInput step={isMetric ? "10" : "0.5"} min="1" value={W}
                                onChange={val => setDialog(p => ({ ...p, width: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Total Height (Y)</div>
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
                </div>

                <div className="inspector-card" style={{ margin: 0 }}>
                    <h4>Shelf Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={labelStyle}>Shelf Count</div>
                            <input type="number" step="1" min="1" max="50" value={count}
                                onChange={e => setDialog(p => ({ ...p, count: e.target.value }))}
                                style={inputStyle} />
                        </div>
                        <div>
                            <div style={labelStyle}>Material Thickness ({unitFmtLabel})</div>
                            <NumericInput step={isMetric ? "1" : "0.125"} min={isMetric ? "3" : "0.25"} value={t}
                                onChange={val => setDialog(p => ({ ...p, thickness: isMetric ? val / 25.4 : val }))}
                                style={inputStyle} />
                        </div>
                    </div>
                    {hasParent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                            <input
                                type="checkbox"
                                checked={!!dialog.addShelfPins}
                                onChange={e => setDialog(p => ({ ...p, addShelfPins: e.target.checked }))}
                                style={{ width: '14px', height: '14px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                id="dialog-add-shelf-pins"
                            />
                            <label htmlFor="dialog-add-shelf-pins" style={{ fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                                Drill Shelf Pin Holes
                            </label>
                        </div>
                    )}
                </div>

                {!valid && (
                    <div className="inspector-card" style={{ margin: 0, background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.3)' }}>
                        <h4 style={{ color: '#ff3b30' }}>⚠ Invalid Dimensions</h4>
                        <div style={{ fontSize: '0.78rem', color: '#ff3b30' }}>
                            The total height is not tall enough to fit this many shelves of the given thickness.
                        </div>
                    </div>
                )}

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
                        {dialog.editGroupId ? '📚 Update Shelves' : '📚 Build Shelves'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShelvingBuilderDialog;
