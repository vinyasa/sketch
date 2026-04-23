import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../store/useStore';
import { renderAssemblyThumbnail } from '../../utils/assemblyThumbnail';

// ─── CategorySelect: dropdown + inline "Add New…" ────────────────────────────
const CategorySelect = ({ value, onChange, style }) => {
    const { assemblyCategories, addAssemblyCategory } = useStore();
    const [adding, setAdding] = useState(false);
    const [newCat, setNewCat] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

    const commit = () => {
        const trimmed = newCat.trim();
        if (trimmed) {
            const added = addAssemblyCategory(trimmed);
            onChange(added ? trimmed : (assemblyCategories.includes(trimmed) ? trimmed : value));
        }
        setNewCat('');
        setAdding(false);
    };

    if (adding) {
        return (
            <div style={{ display: 'flex', gap: '4px' }}>
                <input
                    ref={inputRef}
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setNewCat(''); } }}
                    placeholder="New category name…"
                    style={{ ...style, flex: 1, minWidth: 0 }}
                />
                <button onClick={commit} style={{ padding: '4px 8px', background: 'rgba(188,138,95,0.2)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>✓</button>
                <button onClick={() => { setAdding(false); setNewCat(''); }} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
            </div>
        );
    }

    return (
        <select
            value={value}
            onChange={e => {
                if (e.target.value === '__add_new__') { setAdding(true); }
                else { onChange(e.target.value); }
            }}
            style={style}
        >
            {assemblyCategories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__add_new__">＋ Add New…</option>
        </select>
    );
};

// ─── Tag chip input ───────────────────────────────────────────────────────────
const TagInput = ({ tags, onChange }) => {
    const [input, setInput] = useState('');

    const commit = () => {
        const vals = input.split(',').map(s => s.trim()).filter(Boolean);
        if (vals.length) {
            onChange([...new Set([...tags, ...vals])]);
            setInput('');
        }
    };

    const removeTag = (t) => onChange(tags.filter(x => x !== t));

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '4px 6px', minHeight: '32px' }}>
            {tags.map(t => (
                <span key={t} style={{ background: 'rgba(188,138,95,0.2)', color: 'var(--accent-color)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    #{t}
                    <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', lineHeight: 1 }}>×</button>
                </span>
            ))}
            <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
                onBlur={commit}
                placeholder={tags.length ? '' : 'type tags, press Enter…'}
                style={{ flex: 1, minWidth: '80px', background: 'none', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '0.75rem', fontFamily: 'inherit' }}
            />
        </div>
    );
};

// ─── Save form (inline, expands below the Add button) ────────────────────────
// existingEntry: a library entry whose name matches the selected group, if any.
const SaveForm = ({ groupName, onSave, onCancel, boards, existingEntry }) => {
    const [name, setName] = useState(existingEntry?.name ?? groupName ?? 'My Assembly');
    const [category, setCategory] = useState(existingEntry?.category ?? 'Uncategorized');
    const [tags, setTags] = useState(existingEntry?.tags ?? []);
    const [thumb, setThumb] = useState(null);
    const [generating, setGenerating] = useState(true);
    // Replace mode: shown only when a matching entry exists
    const [replaceMode, setReplaceMode] = useState(!!existingEntry);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const url = await renderAssemblyThumbnail(boards);
            if (!cancelled) { setThumb(url); setGenerating(false); }
        })();
        return () => { cancelled = true; };
    }, [boards]);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            name: name.trim(),
            category,
            tags,
            thumbnail: thumb,
            replaceId: replaceMode && existingEntry ? existingEntry.id : undefined,
        });
    };

    return (
        <div className="inspector-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            {/* Thumbnail preview */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: 72, height: 72, borderRadius: '6px', overflow: 'hidden', background: '#1a1a1a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                    {generating
                        ? <span style={{ fontSize: '1.4rem' }}>⏳</span>
                        : <img src={thumb} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    }
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        autoFocus
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '5px 8px', color: 'var(--text-main)', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', width: '100%' }}
                    />
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
                    <CategorySelect
                        value={category}
                        onChange={setCategory}
                        style={{
                            width: '100%',
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '5px 8px',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem',
                            fontFamily: 'inherit',
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    />
                </div>
            </div>

            <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tags</label>
            <TagInput tags={tags} onChange={setTags} />

            {/* ── Replace / Save-as-new toggle (shown only when a match exists) ── */}
            {existingEntry && (
                <div style={{ background: 'rgba(188,138,95,0.08)', border: '1px solid rgba(188,138,95,0.25)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Found existing entry</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: !replaceMode ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        <input
                            type="radio" name="saveMode" checked={!replaceMode}
                            onChange={() => setReplaceMode(false)}
                            style={{ accentColor: 'var(--accent-color)' }}
                        />
                        Save as New Copy
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: replaceMode ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: replaceMode ? 600 : 400 }}>
                        <input
                            type="radio" name="saveMode" checked={replaceMode}
                            onChange={() => setReplaceMode(true)}
                            style={{ accentColor: 'var(--accent-color)' }}
                        />
                        Replace “{existingEntry.name}” in library
                    </label>
                </div>
            )}

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                    onClick={handleSave}
                    disabled={generating || !name.trim()}
                    style={{ flex: 1, padding: '7px', background: 'rgba(188,138,95,0.2)', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem', cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1 }}
                >
                    {generating ? 'Generating…' : replaceMode ? '↺ Replace in Library' : '✓ Save to Library'}
                </button>
                <button
                    onClick={onCancel}
                    style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

// ─── Edit modal (portal to document.body — no overflow clipping) ──────────────
const LibraryEditModal = ({ entry, onSave, onClose }) => {
    const [name, setName] = useState(entry.name);
    const [category, setCategory] = useState(entry.category || 'Uncategorized');
    const [tags, setTags] = useState(entry.tags || []);

    // Esc to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), category, tags });
    };

    const fieldStyle = {
        width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)',
        borderRadius: '6px', padding: '8px 10px', color: 'var(--text-main)',
        fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    };
    const selectStyle = {
        ...fieldStyle, cursor: 'pointer', background: 'var(--bg-color)',
    };
    const labelStyle = {
        fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.6px', display: 'block', marginBottom: '5px', fontWeight: 600,
    };

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
            }}
        >
            {/* Dialog card */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--panel-bg)', backdropFilter: 'var(--panel-blur)',
                    border: '1px solid var(--accent-color)',
                    borderRadius: '12px',
                    padding: '24px',
                    width: '380px',
                    maxWidth: '90vw',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {entry.thumbnail && (
                        <div style={{ width: 56, height: 56, borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-color)' }}>
                            <img src={entry.thumbnail} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Edit Library Entry</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-color)', marginTop: '2px' }}>{entry.name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '4px' }}
                        title="Close (Esc)"
                    >✕</button>
                </div>

                {/* Name */}
                <div>
                    <label style={labelStyle}>Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                        style={fieldStyle}
                    />
                </div>

                {/* Category */}
                <div>
                    <label style={labelStyle}>Category</label>
                    <CategorySelect value={category} onChange={setCategory} style={selectStyle} />
                </div>

                {/* Tags */}
                <div>
                    <label style={labelStyle}>Tags</label>
                    <TagInput tags={tags} onChange={setTags} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        style={{
                            flex: 1, padding: '9px', background: 'rgba(188,138,95,0.2)',
                            border: '1px solid var(--accent-color)', color: 'var(--accent-color)',
                            borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                        }}
                    >
                        ✓ Save Changes
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 20px', background: 'transparent',
                            border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                            borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};


const LibraryCard = ({ entry, onPlace, onDelete, onEdit }) => {
    const [hovered, setHovered] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
            onDoubleClick={() => onEdit(entry)}
            title="Double-click to edit"
            style={{
                width: '130px',
                flexShrink: 0,
                background: hovered ? 'rgba(188,138,95,0.08)' : 'rgba(0,0,0,0.25)',
                border: `1px solid ${hovered ? 'var(--accent-color)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.18s ease',
                transform: hovered ? 'translateY(-2px)' : 'none',
                boxShadow: hovered ? '0 6px 16px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            }}
        >
            {/* Thumbnail */}
            <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#111', overflow: 'hidden', position: 'relative' }}>
                {entry.thumbnail
                    ? <img src={entry.thumbnail} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>📦</div>
                }
                {/* Category badge */}
                <span style={{
                    position: 'absolute', top: '5px', left: '5px',
                    background: 'rgba(0,0,0,0.75)', color: 'var(--accent-color)',
                    fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                    letterSpacing: '0.4px',
                }}>
                    {entry.category}
                </span>
            </div>

            {/* Info */}
            <div style={{ padding: '7px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>
                    {entry.name}
                </div>

                {/* Tags */}
                {entry.tags && entry.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {entry.tags.slice(0, 3).map(t => (
                            <span key={t} style={{ background: 'rgba(188,138,95,0.15)', color: 'var(--text-muted)', fontSize: '0.6rem', padding: '1px 5px', borderRadius: '8px' }}>#{t}</span>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                    <button
                        onClick={() => onPlace(entry.id)}
                        style={{ flex: 1, padding: '4px 0', background: 'rgba(188,138,95,0.15)', border: '1px solid rgba(188,138,95,0.3)', color: 'var(--accent-color)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-color)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(188,138,95,0.15)'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                    >
                        ▶ Place
                    </button>
                    {confirmDelete ? (
                        <button
                            onClick={() => onDelete(entry.id)}
                            style={{ padding: '4px 8px', background: 'rgba(255,59,48,0.2)', border: '1px solid rgba(255,59,48,0.4)', color: '#ff3b30', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                        >
                            ✓
                        </button>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                            title="Delete"
                        >
                            🗑
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────
const AssemblyLibraryPanel = () => {
    const {
        assemblyLibrary,
        boards, groups, selectedItemIds,
        saveAssemblyToLibrary,
        placeAssemblyFromLibrary,
        deleteAssemblyFromLibrary,
        updateAssemblyInLibrary,
        setupLibraryDiskBackup,
        importLibraryFromFile,
        libraryDiskHandle,
    } = useStore();

    const [showSaveForm, setShowSaveForm] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [editingEntry, setEditingEntry] = useState(null); // entry being edited in modal

    // ── Determine what's selected ─────────────────────────────────────────────
    const selectedGroupId = selectedItemIds.length === 1
        ? Object.keys(groups).find(k => k === selectedItemIds[0])
        : null;

    // Collect all descendant boards of the selected group for thumbnail preview
    const selectedGroupBoards = useCallback(() => {
        if (!selectedGroupId) return [];
        const collect = (gid) => {
            const childGroups = Object.keys(groups).filter(k => groups[k].parentId === gid);
            const childBoards = boards.filter(b => b.parentId === gid);
            return [...childBoards, ...childGroups.flatMap(cg => collect(cg))];
        };
        return collect(selectedGroupId);
    }, [selectedGroupId, groups, boards])();

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = assemblyLibrary.filter(e => {
        const matchText = !filterText || e.name.toLowerCase().includes(filterText.toLowerCase())
            || (e.tags || []).some(t => t.toLowerCase().includes(filterText.toLowerCase()));
        const matchCat = filterCategory === 'All' || e.category === filterCategory;
        return matchText && matchCat;
    });

    const usedCategories = ['All', ...new Set(assemblyLibrary.map(e => e.category).filter(Boolean))];

    const handleSave = async (meta) => {
        await saveAssemblyToLibrary(meta);
        setShowSaveForm(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>

            {/* ── Edit modal (portal) ── */}
            {editingEntry && (
                <LibraryEditModal
                    entry={editingEntry}
                    onSave={(patch) => { updateAssemblyInLibrary(editingEntry.id, patch); setEditingEntry(null); }}
                    onClose={() => setEditingEntry(null)}
                />
            )}

            {/* ── Add button ── */}
            <button
                onClick={() => selectedGroupId && setShowSaveForm(v => !v)}
                disabled={!selectedGroupId}
                style={{
                    width: '100%', padding: '7px', fontSize: '0.78rem', fontWeight: 600,
                    background: selectedGroupId ? 'rgba(188,138,95,0.15)' : 'rgba(0,0,0,0.1)',
                    border: `1px solid ${selectedGroupId ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    color: selectedGroupId ? 'var(--accent-color)' : 'var(--text-muted)',
                    borderRadius: '6px', cursor: selectedGroupId ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                }}
                title={selectedGroupId ? 'Add selected assembly to library' : 'Select an assembly (group) first'}
            >
                {showSaveForm ? '✕ Cancel' : '+ Add Selected Assembly to Library'}
            </button>

            {/* ── Inline save form ── */}
            {showSaveForm && selectedGroupId && (
                <SaveForm
                    groupName={selectedGroupId}
                    boards={selectedGroupBoards}
                    existingEntry={assemblyLibrary.find(e => e.name === selectedGroupId) ?? null}
                    onSave={handleSave}
                    onCancel={() => setShowSaveForm(false)}
                />
            )}

            {/* ── Filter row ── */}
            {assemblyLibrary.length > 0 && (
                <div className="inspector-card" style={{ display: 'flex', gap: '6px' }}>
                    <input
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        placeholder="🔍 Search…"
                        style={{
                            flex: 1, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)',
                            borderRadius: '4px', padding: '4px 8px', color: 'var(--text-main)', fontSize: '0.75rem',
                            fontFamily: 'inherit', outline: 'none',
                        }}
                    />
                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        style={{
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: 'var(--text-main)',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                            outline: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        {usedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            )}

            {/* ── Grid ── */}
            {assemblyLibrary.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '20px 8px', lineHeight: 1.6 }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📦</div>
                    <div>No assemblies saved yet.</div>
                    <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>Select a group in the Outliner, then click <strong style={{ color: 'var(--accent-color)' }}>Add Selected Assembly</strong>.</div>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '16px' }}>
                    No matches for "{filterText}"
                </div>
            ) : (
                <div className="inspector-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', overflowY: 'auto', alignContent: 'flex-start' }}>
                    {filtered.map(entry => (
                        <LibraryCard
                            key={entry.id}
                            entry={entry}
                            onPlace={placeAssemblyFromLibrary}
                            onDelete={deleteAssemblyFromLibrary}
                            onEdit={setEditingEntry}
                        />
                    ))}
                </div>
            )}

            {/* ── Footer ── */}
            <div className="inspector-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: 'auto' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: libraryDiskHandle ? '#34c759' : '#ff9f0a', display: 'inline-block', flexShrink: 0 }} />
                    {libraryDiskHandle ? 'Disk backup: active' : 'Disk backup: not configured'}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={setupLibraryDiskBackup}
                        style={{ flex: 1, padding: '5px', fontSize: '0.68rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer' }}
                        title={libraryDiskHandle ? 'Change backup file location' : 'Set up disk backup'}
                    >
                        💾 {libraryDiskHandle ? 'Change Backup' : 'Set Up Backup'}
                    </button>
                    <button
                        onClick={importLibraryFromFile}
                        style={{ flex: 1, padding: '5px', fontSize: '0.68rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer' }}
                        title="Import a library JSON file"
                    >
                        📂 Load File
                    </button>
                </div>
                {assemblyLibrary.length > 0 && (
                    <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {assemblyLibrary.length} entr{assemblyLibrary.length === 1 ? 'y' : 'ies'} in library
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssemblyLibraryPanel;
