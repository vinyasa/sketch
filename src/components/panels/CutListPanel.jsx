import React from 'react';

import useStore from '../../store/useStore';

const CutListPanel = () => {
    const { boards } = useStore();
    return (
        <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Lumber</th>
                        <th style={{ padding: '8px' }}>Component Name</th>
                        <th style={{ padding: '8px' }}>Length (in)</th>
                        <th style={{ padding: '8px' }}>Width (in)</th>
                        <th style={{ padding: '8px' }}>Thickness (in)</th>
                    </tr>
                </thead>
                <tbody>
                    {boards.map(b => {
                        const dims = [...b.size].sort((x, y) => y - x);
                        return (
                            <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '8px', textTransform: 'capitalize' }}>{b.material.replace('-', ' ')}</td>
                                <td style={{ padding: '8px' }}>{b.name}</td>
                                <td style={{ padding: '8px' }}>{dims[0].toFixed(4)}</td>
                                <td style={{ padding: '8px' }}>{dims[1].toFixed(4)}</td>
                                <td style={{ padding: '8px' }}>{dims[2].toFixed(4)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default CutListPanel;
