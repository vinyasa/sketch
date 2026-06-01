import React, { useState } from 'react';
import useStore from '../../store/useStore';

const LIBRARIES = [
    {
        name: 'Luceysketch (This App)',
        role: '3D Parametric Woodshop Modeler',
        author: 'Todd Carpenter',
        url: 'https://github.com/vinyasa/sketch',
        license: 'GNU GPL v3',
        copyright: 'Copyright (C) 2026 Todd Carpenter',
        fullLicense: `Luceysketch is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.`
    },
    {
        name: 'Three.js',
        role: '3D Graphics Engine',
        author: 'Ricardo Cabello (Mr.doob) & contributors',
        url: 'https://github.com/mrdoob/three.js',
        license: 'MIT',
        copyright: 'Copyright (c) 2010-2026 Three.js authors',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'React Three Fiber',
        role: 'Three.js React Renderer',
        author: 'pmndrs',
        url: 'https://github.com/pmndrs/react-three-fiber',
        license: 'MIT',
        copyright: 'Copyright (c) 2019-2026 pmndrs',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'React Three Drei',
        role: 'R3F Helpers & Utilities',
        author: 'pmndrs',
        url: 'https://github.com/pmndrs/drei',
        license: 'MIT',
        copyright: 'Copyright (c) 2020-2026 pmndrs',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'three-mesh-bvh',
        role: 'Spatial BVH Accelerator',
        author: 'Garrett Johnson',
        url: 'https://github.com/gkjohnson/three-mesh-bvh',
        license: 'MIT',
        copyright: 'Copyright (c) 2018-2026 Garrett Johnson',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'three-bvh-csg',
        role: 'Constructive Solid Geometry (CSG) Engine',
        author: 'Garrett Johnson',
        url: 'https://github.com/gkjohnson/three-bvh-csg',
        license: 'MIT',
        copyright: 'Copyright (c) 2022-2026 Garrett Johnson',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'React & React DOM',
        role: 'User Interface Engine',
        author: 'Meta Platforms, Inc. and affiliates',
        url: 'https://github.com/facebook/react',
        license: 'MIT',
        copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'Zustand',
        role: 'State Management Store',
        author: 'pmndrs',
        url: 'https://github.com/pmndrs/zustand',
        license: 'MIT',
        copyright: 'Copyright (c) 2019-2026 pmndrs',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    },
    {
        name: 'Vite',
        role: 'Development Build Tool',
        author: 'Yuxi (Evan) You & contributors',
        url: 'https://github.com/vitejs/vite',
        license: 'MIT',
        copyright: 'Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors',
        fullLicense: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
    }
];

const AttributionDialog = () => {
    const { showAttributionDialog, setShowAttributionDialog } = useStore();
    const [selectedIdx, setSelectedIdx] = useState(0);

    if (!showAttributionDialog) return null;

    const currentLib = LIBRARIES[selectedIdx];

    return (
        <div className="app-overlay" style={{
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10002,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'fixed',
            inset: 0,
            padding: '20px',
            backdropFilter: 'blur(3px)'
        }} onClick={() => setShowAttributionDialog(false)}>
            <div className="glass-panel" style={{
                padding: '30px',
                maxWidth: '820px',
                width: '100%',
                height: '560px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                color: 'var(--text-main)',
                position: 'relative',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                
                <button className="nav-btn" onClick={() => setShowAttributionDialog(false)} style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(128,128,128,0.15)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    color: 'var(--text-muted)',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.target.style.background = 'rgba(255,59,48,0.15)'; e.target.style.color = '#ff3b30'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(128,128,128,0.15)'; e.target.style.color = 'var(--text-muted)'; }}
                >
                    &times;
                </button>

                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📜 Open Source Attributions
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Luceysketch is built on the shoulders of giants. The following libraries power our 3D viewport, constraint solver, and interface.
                    </p>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '20px', marginTop: '4px' }}>
                    {/* Left Sidebar: Library list */}
                    <div style={{
                        width: '240px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        overflowY: 'auto',
                        paddingRight: '6px',
                        borderRight: '1px solid var(--border-color)'
                    }}>
                        {LIBRARIES.map((lib, idx) => (
                            <div
                                key={lib.name}
                                onClick={() => setSelectedIdx(idx)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: selectedIdx === idx ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.03)',
                                    color: selectedIdx === idx ? '#fff' : 'var(--text-main)',
                                    border: selectedIdx === idx ? '1px solid var(--accent-color)' : '1px solid transparent',
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                    if (selectedIdx !== idx) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                }}
                                onMouseLeave={e => {
                                    if (selectedIdx !== idx) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                }}
                            >
                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{lib.name}</div>
                                <div style={{
                                    fontSize: '0.66rem',
                                    color: selectedIdx === idx ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {lib.role}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Side: License Details */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        height: '100%'
                    }}>
                        {currentLib && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-color)' }}>{currentLib.name}</h3>
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {currentLib.role} • {currentLib.license} License
                                        </div>
                                    </div>
                                    <a
                                        href={currentLib.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="nav-btn"
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '0.72rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: 'rgba(128,128,128,0.1)',
                                            border: '1px solid var(--border-color)',
                                            textDecoration: 'none',
                                            borderRadius: '6px',
                                            color: 'var(--text-main)',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.target.style.background = 'rgba(255, 122, 0, 0.15)'; e.target.style.borderColor = 'var(--accent-color)'; }}
                                        onMouseLeave={e => { e.target.style.background = 'rgba(128,128,128,0.1)'; e.target.style.borderColor = 'var(--border-color)'; }}
                                    >
                                        🔗 GitHub
                                    </a>
                                </div>

                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                                    {currentLib.copyright}
                                </div>

                                <div style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    overflowY: 'auto',
                                    fontSize: '0.72rem',
                                    fontFamily: 'monospace',
                                    lineHeight: '1.45',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {currentLib.fullLicense}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
                    <button
                        className="nav-btn"
                        style={{ padding: '8px 22px', background: 'var(--accent-color)', color: '#fff', border: 'none', fontWeight: 'bold' }}
                        onClick={() => setShowAttributionDialog(false)}
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AttributionDialog;
