import React from 'react';

import useStore from '../../store/useStore';

const OutlinerPanel = () => {
    const {
        groups, boards, selectedItemIds,
        toggleSelection, toggleGroupVisibility, toggleBoardVisibility,
        setGroups, handleDragStart: onDragStart, handleDrop: onDrop,
        manualAddBoard: onAddBoard, manualAddAssembly: onAddAssembly
    } = useStore();

    const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const renderTree = (nodeId, depth = 0, isParentSelected = false) => {
        const isGroup = groups[nodeId] !== undefined;
        const g = isGroup ? groups[nodeId] : boards.find(b => b.id.toString() === nodeId);
        if (!g) return null;

        const isSelected = selectedItemIds.includes(nodeId.toString()) || isParentSelected;

        const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
        const childBoards = boards.filter(b => b.parentId === nodeId);
        const hasChildren = childGroups.length > 0 || childBoards.length > 0;

        return (
            <div key={nodeId} style={{ marginLeft: depth > 0 ? 12 : 0 }}>
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
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); isGroup ? toggleGroupVisibility(nodeId) : toggleBoardVisibility(parseInt(nodeId)); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: g.visible !== false ? 1 : 0.3, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}
                        title="Toggle Visibility"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
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

                <div style={{ marginTop: '24px', display: 'flex', gap: '8px', padding: '0 8px' }}>
                    <button className="nav-btn" style={{ flex: 1, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }} onClick={onAddBoard}>+ New Board</button>
                    <button className="nav-btn" style={{ flex: 1, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }} onClick={onAddAssembly}>+ Assembly</button>
                </div>
                <p className="hint" style={{ textAlign: 'center', marginTop: '8px' }}>Generates pieces inside your selected group.</p>
            </div>
        </div>
    );
};

export default OutlinerPanel;
