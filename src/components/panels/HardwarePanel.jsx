import React, { useState, useRef } from 'react';
import useStore from '../../store/useStore';
import { HARDWARE_CATALOGUE, getHardwareByCategory } from '../../utils/hardwareCatalogue';
import { fileToDataUri, setupHardwareDiskBackup, importHardwareLibraryFromFile, persistHardwareLibrary } from '../../utils/hardwareLibraryPersistence';

// ─── Individual hardware card ────────────────────────────────────────────────
const HardwareCard = ({ item, onAdd, onRemove }) => {
    const [hov, setHov] = useState(false);
    return (
        <div
            className="inspector-card"
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', margin: 0, marginBottom: '6px',
                background: hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hov ? 'var(--accent-color)' : 'var(--border-color)'}`,
                transition: 'all 0.15s',
                transform: hov ? 'translateY(-2px)' : 'none',
                boxShadow: hov ? '0 6px 16px rgba(0,0,0,0.3)' : 'none',
            }}
        >
            <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(188,138,95,0.15)',
                border: '1px solid rgba(188,138,95,0.3)',
                fontSize: '1.1rem',
            }}>
                {item.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {item.description}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <div
                    onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                    style={{
                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-color)',
                        opacity: hov ? 1 : 0.5, transition: 'opacity 0.15s',
                        cursor: 'pointer',
                    }}
                >
                    + Add
                </div>
                {onRemove && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                        style={{
                            fontSize: '0.62rem', fontWeight: 600, color: '#ff3b30',
                            opacity: hov ? 1 : 0.3, transition: 'opacity 0.15s',
                            cursor: 'pointer',
                        }}
                    >
                        ✕ Remove
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Panel ───────────────────────────────────────────────────────────────────
const HardwarePanel = () => {
    const {
        selectedItemIds, boards, addHardware, showToast,
        customHardware, addCustomHardware, removeCustomHardware,
        hardwareLibraryDiskHandle, setHardwareLibraryDiskHandle,
        hiddenBuiltinHardware, hideBuiltinHardware, restoreBuiltinHardware,
    } = useStore();
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    // Pending import state: holds the converted data URI + defaults until user confirms
    const [pendingImport, setPendingImport] = useState(null); // { dataUri, fileName, fileSize }
    const [importName, setImportName] = useState('');
    const [importCategory, setImportCategory] = useState('Custom');
    const [newCategory, setNewCategory] = useState('');

    // Collect all unique category names from built-in + custom
    const allCategories = [...new Set([
        ...Object.keys(getHardwareByCategory()),
        ...customHardware.map(h => h.category).filter(Boolean),
        'Custom',
    ])];

    const handleAdd = (item) => {
        if (selectedItemIds.length === 0) {
            showToast('Select a board first, then add hardware');
            return;
        }
        for (const id of selectedItemIds) {
            const board = boards.find(b => b.id.toString() === id);
            if (board) {
                addHardware(board.id, item, item.defaultFace || 'front');
            }
        }
        showToast(`${item.label} attached ✓`);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (file.name.toLowerCase().endsWith('.gltf')) {
            showToast('Please use .GLB format (not .gltf). GLB files are self-contained and load correctly.');
            return;
        }

        setImporting(true);
        try {
            const dataUri = await fileToDataUri(file);
            const name = file.name.replace(/\.glb$/i, '');
            setPendingImport({ dataUri, fileName: name, fileSize: file.size });
            setImportName(name);
            setImportCategory('Custom');
            setNewCategory('');
        } catch (err) {
            showToast('Failed to read file: ' + err.message);
        } finally {
            setImporting(false);
        }
    };

    const handleConfirmImport = () => {
        if (!pendingImport) return;
        const category = newCategory.trim() || importCategory;
        const customItem = {
            id: 'custom_' + Date.now(),
            label: importName.trim() || pendingImport.fileName,
            modelUrl: pendingImport.dataUri,
            icon: '📦',
            description: `${category} · ${(pendingImport.fileSize / 1024).toFixed(0)} KB`,
            defaultFace: 'front',
            category,
        };
        addCustomHardware(customItem);
        showToast(`"${customItem.label}" added to ${category}`);
        setPendingImport(null);
    };

    const handleCancelImport = () => {
        setPendingImport(null);
    };

    const handleSaveLibrary = async () => {
        const handle = await setupHardwareDiskBackup(customHardware);
        if (handle) {
            setHardwareLibraryDiskHandle(handle);
            showToast('Hardware library saved to disk ✓');
        }
    };

    const handleLoadLibrary = async () => {
        const { merged, count } = await importHardwareLibraryFromFile(customHardware);
        if (count > 0) {
            useStore.setState({ customHardware: merged });
            await persistHardwareLibrary(merged, hardwareLibraryDiskHandle);
            showToast(`Imported ${count} hardware model${count !== 1 ? 's' : ''} ✓`);
        } else {
            showToast('No new models found in file');
        }
    };

    const categories = getHardwareByCategory();
    const hiddenSet = new Set(hiddenBuiltinHardware);

    // Filter out hidden built-in items and skip empty categories
    const visibleCategories = Object.entries(categories)
        .map(([cat, items]) => [cat, items.filter(item => !hiddenSet.has(item.id))])
        .filter(([, items]) => items.length > 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selectedItemIds.length === 0 && (
                <div style={{
                    fontSize: '0.72rem', color: 'var(--accent-color)',
                    background: 'rgba(188,138,95,0.1)', padding: '8px 10px',
                    borderRadius: '6px', border: '1px solid rgba(188,138,95,0.2)',
                    lineHeight: 1.4,
                }}>
                    Select a board first, then pick hardware to attach.
                </div>
            )}

            {visibleCategories.map(([category, items]) => (
                <div key={category}>
                    <div style={{
                        fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.6px', fontWeight: 700, marginBottom: '6px',
                    }}>
                        {category}
                    </div>
                    {items.map(item => (
                        <HardwareCard key={item.id} item={item} onAdd={handleAdd} onRemove={(id) => hideBuiltinHardware(id)} />
                    ))}
                </div>
            ))}

            {/* Restore hidden defaults link */}
            {hiddenBuiltinHardware.length > 0 && (
                <div
                    onClick={restoreBuiltinHardware}
                    style={{
                        fontSize: '0.62rem', color: 'var(--text-muted)', cursor: 'pointer',
                        textAlign: 'center', textDecoration: 'underline',
                        opacity: 0.7, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.target.style.opacity = 1}
                    onMouseLeave={e => e.target.style.opacity = 0.7}
                >
                    Restore {hiddenBuiltinHardware.length} hidden default{hiddenBuiltinHardware.length !== 1 ? 's' : ''}
                </div>
            )}

            {/* ── Custom Models Section ── */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '6px',
                }}>
                    <div style={{
                        fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.6px', fontWeight: 700,
                    }}>
                        My Hardware Library ({customHardware.length})
                    </div>
                </div>

                {/* Group custom items by category */}
                {(() => {
                    const grouped = {};
                    customHardware.forEach(item => {
                        const cat = item.category || 'Custom';
                        if (!grouped[cat]) grouped[cat] = [];
                        grouped[cat].push(item);
                    });
                    return Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat} style={{ marginBottom: '6px' }}>
                            <div style={{
                                fontSize: '0.55rem', color: 'var(--accent-color)', textTransform: 'uppercase',
                                letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px',
                                opacity: 0.7,
                            }}>
                                {cat}
                            </div>
                            {items.map(item => (
                                <HardwareCard
                                    key={item.id}
                                    item={item}
                                    onAdd={handleAdd}
                                    onRemove={removeCustomHardware}
                                />
                            ))}
                        </div>
                    ));
                })()}

                {/* ── Import flow: button or inline form ── */}
                {pendingImport ? (
                    <div style={{
                        padding: '10px', borderRadius: '8px',
                        border: '1px solid var(--accent-color)',
                        background: 'rgba(188,138,95,0.08)',
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Import: {pendingImport.fileName}
                        </div>

                        {/* Name */}
                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Name</div>
                            <input
                                type="text"
                                value={importName}
                                onChange={e => setImportName(e.target.value)}
                                style={{
                                    width: '100%', padding: '5px 8px', fontSize: '0.75rem',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '4px',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        {/* Category select */}
                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Category</div>
                            <select
                                value={importCategory}
                                onChange={e => { setImportCategory(e.target.value); if (e.target.value !== '__new__') setNewCategory(''); }}
                                style={{
                                    width: '100%', padding: '5px 8px', fontSize: '0.75rem',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '4px',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {allCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                                <option value="__new__">+ New Category...</option>
                            </select>
                        </div>

                        {/* New category input */}
                        {importCategory === '__new__' && (
                            <div style={{ marginBottom: '6px' }}>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '2px' }}>New Category Name</div>
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="e.g. Drawer Pulls"
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '5px 8px', fontSize: '0.75rem',
                                        background: 'var(--bg-color)', color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)', borderRadius: '4px',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        )}

                        {/* Confirm / Cancel */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button
                                className="primary-btn"
                                onClick={handleConfirmImport}
                                disabled={importCategory === '__new__' && !newCategory.trim()}
                                style={{
                                    flex: 1, padding: '6px', fontSize: '0.72rem', fontWeight: 600,
                                    borderRadius: '6px',
                                    opacity: (importCategory === '__new__' && !newCategory.trim()) ? 0.4 : 1,
                                }}
                            >
                                ✓ Add to Library
                            </button>
                            <button
                                className="nav-btn"
                                onClick={handleCancelImport}
                                style={{
                                    padding: '6px 12px', fontSize: '0.72rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <button
                            className="nav-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                            style={{
                                width: '100%', padding: '10px', fontSize: '0.78rem', fontWeight: 600,
                                border: '1px dashed var(--accent-color)',
                                background: 'rgba(188,138,95,0.06)',
                                color: 'var(--accent-color)',
                                borderRadius: '8px', cursor: importing ? 'wait' : 'pointer',
                                transition: 'all 0.15s',
                                opacity: importing ? 0.5 : 1,
                            }}
                        >
                            {importing ? '⏳ Converting...' : '📂 Import .GLB Model'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".glb"
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />
                    </>
                )}

                {/* Library management buttons */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                        className="nav-btn"
                        onClick={handleSaveLibrary}
                        style={{
                            flex: 1, padding: '6px', fontSize: '0.68rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                        }}
                    >
                        💾 Save Library
                    </button>
                    <button
                        className="nav-btn"
                        onClick={handleLoadLibrary}
                        style={{
                            flex: 1, padding: '6px', fontSize: '0.68rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                        }}
                    >
                        📂 Load Library
                    </button>
                </div>

                <p style={{
                    fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '6px',
                    lineHeight: 1.4, textAlign: 'center',
                }}>
                    Use <strong>.GLB</strong> format (binary glTF, self-contained).<br />
                    Download free models from<br />
                    <a href="https://sketchfab.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>Sketchfab</a>
                    {' · '}
                    <a href="https://thangs.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>Thangs</a>
                    {' · '}
                    <a href="https://grabcad.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>GrabCAD</a>
                </p>
            </div>

            <p style={{
                fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center',
                marginTop: '4px', lineHeight: 1.4,
            }}>
                Click hardware in the viewport to select it.<br />
                Adjust position in the Inspector panel.
            </p>
        </div>
    );
};

export default HardwarePanel;
