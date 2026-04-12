import os

file_path = 'd:/Antigravity Dev/Sketch/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_out = """                                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === i ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={c.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{c.enabled === false ? '🔓' : '🔒'}</button>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== i) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                                            </div>"""

new_out = """                                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                {(c.type === 'Flush' || c.type === 'Glue') && (
                                                                                                    <button onClick={() => {
                                                                                                        pushHistory();
                                                                                                        setBoards(prev => prev.map(b => {
                                                                                                            if (b.id === selectedBoard.id) {
                                                                                                                const result = solveAlignmentConstraint(b, c, prev);
                                                                                                                return result ? { ...b, ...result } : b;
                                                                                                            }
                                                                                                            return b;
                                                                                                        }));
                                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                                                                )}
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === i ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={c.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{c.enabled === false ? '🔓' : '🔒'}</button>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== i) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                                            </div>"""

old_in = """                                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === internalIndex ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={constraint.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{constraint.enabled === false ? '🔓' : '🔒'}</button>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== internalIndex) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                                            </div>"""

new_in = """                                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                                {(constraint.type === 'Flush' || constraint.type === 'Glue') && (
                                                                                                    <button onClick={() => {
                                                                                                        pushHistory();
                                                                                                        setBoards(prev => prev.map(b => {
                                                                                                            if (b.id === sourceBoard.id) {
                                                                                                                const result = solveAlignmentConstraint(b, constraint, prev);
                                                                                                                return result ? { ...b, ...result } : b;
                                                                                                            }
                                                                                                            return b;
                                                                                                        }));
                                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                                                                )}
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === internalIndex ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={constraint.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{constraint.enabled === false ? '🔓' : '🔒'}</button>
                                                                                                <button onClick={() => {
                                                                                                    pushHistory();
                                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== internalIndex) } : b));
                                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                                            </div>"""

content = content.replace(old_out, new_out)
content = content.replace(old_in, new_in)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied buttons")
