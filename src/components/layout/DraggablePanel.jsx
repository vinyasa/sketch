import React, { useState, useRef } from 'react';

const DraggablePanel = ({ title, defaultPosition, onFocusCapture, children, defaultSize = { width: 250 } }) => {
    const [pos, setPos] = useState(defaultPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);

    const onPointerDown = (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
            setIsDragging(true);
            dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
            e.target.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    };

    const onPointerMove = (e) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({ x: dragRef.current.posX + dx, y: dragRef.current.posY + dy });
    };

    const onPointerUp = (e) => {
        setIsDragging(false);
        e.target.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="glass-panel" onFocusCapture={onFocusCapture} style={{
            position: 'absolute', left: pos.x, top: pos.y, width: defaultSize.width, maxHeight: '80%',
            padding: '10px', display: 'flex', flexDirection: 'column', borderRadius: '8px',
            zIndex: 100, pointerEvents: 'auto', resize: 'both', overflow: 'hidden', minWidth: '200px', minHeight: '100px',
            boxShadow: isDragging ? '0 16px 32px rgba(0,0,0,0.4)' : 'var(--shadow)'
        }}>
            <div
                className="draggable-handle"
                style={{
                    fontWeight: 600, fontSize: '0.85rem', marginBottom: '10px', cursor: isDragging ? 'grabbing' : 'grab',
                    margin: '-10px -10px 10px -10px', padding: '8px 10px', backgroundColor: 'rgba(0,0,0,0.15)', color: 'var(--accent-color)',
                    borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--border-color)', userSelect: 'none'
                }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            >
                {title}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default DraggablePanel;
