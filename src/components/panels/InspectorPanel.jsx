import React from 'react';
import useStore from '../../store/useStore';
import AssemblyInspector from './AssemblyInspector';
import MultiSelectInspector from './MultiSelectInspector';
import SingleBoardInspector, { PlaneInspector } from './SingleBoardInspector';

const InspectorPanel = () => {
    const { selectedItemIds, boards, groups } = useStore();

    if (!selectedItemIds || selectedItemIds.length === 0) {
        return <div className="hint" style={{ marginTop: '0px' }}>Select a component in the outliner or viewport.</div>;
    }

    if (selectedItemIds.length > 1) {
        return <MultiSelectInspector />;
    }

    const selectedId = selectedItemIds[0];
    const isGroup = Object.keys(groups || {}).includes(selectedId);

    if (isGroup) {
        return <AssemblyInspector selectedGroup={selectedId} />;
    }

    const selectedBoard = boards.find(b => b.id.toString() === selectedId);
    if (selectedBoard) {
        if (selectedBoard.shape === 'plane') {
            return <PlaneInspector selectedBoard={selectedBoard} />;
        }
        return <SingleBoardInspector selectedBoard={selectedBoard} />;
    }

    return <div className="hint" style={{ marginTop: '0px' }}>Select a component in the outliner or viewport.</div>;
};

export default InspectorPanel;
