import React from 'react';

import useStore from '../../store/useStore';

const OutlinerPanel = () => {
    const {
        groups, boards, selectedItemIds,
        toggleSelection, toggleGroupVisibility, toggleBoardVisibility,
        setGroups, handleDragStart: onDragStart, handleDrop: onDrop,
        manualAddAssembly: onAddAssembly,
        overlappingBoardIds,
    } = useStore();

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    // Walk up the group ancestor chain and return false if any ancestor is hidden
    const isEffectivelyVisible = (nodeId, isGroup, g) => {
        if (g.visible === false) return false;
        let parentId = isGroup ? g.parentId : g.parentId;
        while (parentId && parentId !== 'Workspace') {
            const ancestor = groups[parentId];
            if (!ancestor) break;
            if (ancestor.visible === false) return false;
            parentId = ancestor.parentId;
        }
        return true;
    };

    const renderTree = (nodeId, depth = 0, isParentSelected = false) => {
        const isGroup = groups[nodeId] !== undefined;
        const g = isGroup ? groups[nodeId] : boards.find(b => b.id.toString() === nodeId);
        if (!g) return null;

        const isSelected = selectedItemIds.includes(nodeId.toString()) || isParentSelected;

        const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
        const childBoards = boards.filter(b => b.parentId === nodeId);
        const hasChildren = childGroups.length > 0 || childBoards.length > 0;

        const effectivelyVisible = isEffectivelyVisible(nodeId, isGroup, g);
        const ownHidden = g.visible === false;

        return (
            <div key={nodeId} style={{ marginLeft: depth > 0 ? 10 : 0 }}>
                <div
                    className={`tree-item ${isGroup ? 'active' : 'child'} ${isSelected ? 'highlighted' : ''}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    draggable={depth > 0}
                    onDragStart={e => onDragStart(e, nodeId.toString(), isGroup ? 'group' : 'board')}
                    onDragOver={onDragOver}
                    onDrop={e => { if (isGroup) onDrop(e, nodeId); }}
                    onClick={(e) => toggleSelection(nodeId.toString(), e.shiftKey || e.ctrlKey || e.metaKey)}
                >
                    <span style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {isGroup && hasChildren && (
                            <span
                                onClick={(e) => { e.stopPropagation(); setGroups(p => ({ ...p, [nodeId]: { ...p[nodeId], isExpanded: !p[nodeId].isExpanded } })); }}
                                style={{ marginRight: '4px', display: 'inline-block', width: '12px' }}
                            >
                                {g.isExpanded ? '⏷' : '⏵'}
                            </span>
                        )}
                        {isGroup && !hasChildren && <span style={{ marginRight: '4px', display: 'inline-block', width: '12px' }}></span>}
                        {isGroup ? nodeId : g.name}
                        {!isGroup && overlappingBoardIds && overlappingBoardIds.includes(nodeId) && (
                            <span title="Board is physically overlapping another board" style={{ marginLeft: '6px', color: '#ff3b30' }}>⚠️</span>
                        )}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); isGroup ? toggleGroupVisibility(nodeId) : toggleBoardVisibility(parseInt(nodeId)); }}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            opacity: effectivelyVisible ? 1 : 0.35,
                            color: ownHidden ? 'var(--text-muted)' : 'var(--text-main)',
                            display: 'flex', alignItems: 'center',
                        }}
                        title={effectivelyVisible ? 'Hide' : ownHidden ? 'Show' : 'Hidden by parent assembly'}
                    >
                        {effectivelyVisible ? (
                            /* Open eye */
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        ) : (
                            /* Slashed eye */
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        )}
                    </button>
                </div>

                {isGroup && g.isExpanded && (
                    <div>
                        {childGroups.map(k => renderTree(k, depth + 1, isSelected))}
                        {childBoards.map(b => renderTree(b.id.toString(), depth + 1, isSelected))}
                    </div>
                )}
            </div>
        );
    };

    const rootNodes = Object.keys(groups).filter(k => groups[k].parentId === null);

    return (
        <div className="tree-view" style={{ flex: 1, overflowY: 'auto', paddingBottom: '8px' }}>
            <div className="tree-view" style={{ paddingBottom: '24px' }}>
                {rootNodes.map(k => renderTree(k))}

                <div style={{ marginTop: '14px', padding: '0 6px' }}>
                    <button className="nav-btn" style={{ width: '100%', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)', fontSize: '0.7rem', padding: '4px 8px' }} onClick={onAddAssembly}>+ Assembly</button>
                </div>
                <p className="hint" style={{ textAlign: 'center', marginTop: '4px' }}>Use ＋ Add in the toolbar to add components.</p>
            </div>
        </div>
    );
};

export default OutlinerPanel;
