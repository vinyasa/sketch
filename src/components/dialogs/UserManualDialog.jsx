import React, { useState } from 'react';
import useStore from '../../store/useStore';
import rawManualText from '../../../docs/user_manual.md?raw';

const UserManualDialog = () => {
    const { showUserManualDialog, setShowUserManualDialog } = useStore();
    const [activeSection, setActiveSection] = useState('quickstart');

    if (!showUserManualDialog) return null;

    // Normalize CRLF to LF first to make splitting perfectly cross-platform
    const normalizedText = rawManualText.replace(/\r\n/g, '\n');

    // Split by '\n## ' (no anchors to bypass JS RegExp split multiline engine bugs!)
    const parts = normalizedText.split(/\n##\s+/);
    
    // Part 0: Title & Welcome Header
    const welcomeMarkdown = parts[0] || '';
    
    // Prepend '## ' to restore headers consumed by the split delimiter
    const quickstartMarkdown = parts[1] ? '## ' + parts[1] : '';
    const coordinatesMarkdown = parts[2] ? '## ' + parts[2] : '';
    const cutsMarkdown = parts[3] ? '## ' + parts[3] : '';
    const troubleshootingMarkdown = parts[4] ? '## ' + parts[4] : '';

    // File Downloader: Always uses the exact raw markdown from docs/user_manual.md
    const handleDownload = () => {
        const blob = new Blob([rawManualText], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Luceysketch_User_Manual.md');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print Dispatcher: Dynamically parses docs/user_manual.md into a high-contrast shop typography layout
    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) return;

        // Dynamic markdown-to-HTML converter for printing
        const mdToPrintHtml = (md) => {
            const lines = md.split(/\r?\n/);
            let html = '';
            let listType = null; // 'ul', 'ol' or null
            let inAlert = false;
            let alertType = '';
            let alertLines = [];

            let inCodeBlock = false;
            let codeLines = [];
            let codeLang = '';

            let listStartNum = 1;
            const flushList = () => {
                if (listType === 'ul') {
                    html += '</ul>';
                } else if (listType === 'ol') {
                    html += '</ol>';
                }
                listType = null;
            };

            const flushAlert = () => {
                if (inAlert) {
                    const alertText = alertLines.join(' ');
                    const title = alertType || 'Notice';
                    html += `<div class="notice"><div class="notice-title">💡 ${title}</div>${parseInline(alertText)}</div>`;
                    alertLines = [];
                    inAlert = false;
                }
            };

            const parseInline = (str) => {
                return str
                    .replace(/\*\Delta/g, '') // safety fallback
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 900; color: #000;">$1</strong>')
                    .replace(/`(.*?)`/g, '<code>$1</code>');
            };

            lines.forEach(line => {
                const trimmed = line.trim();

                // Code Blocks Handling starting with ```
                if (trimmed.startsWith('```')) {
                    flushList();
                    flushAlert();
                    if (inCodeBlock) {
                        if (codeLang === 'mermaid') {
                            html += `
                            <div style="border: 1.5px solid #444; border-radius: 6px; padding: 12px; margin: 12px 0; background: #fafafa; box-sizing: border-box; width: 100%; page-break-inside: avoid;">
                                <div style="text-align: center; margin-bottom: 12px;">
                                    <span style="font-weight: 900; border: 1.5px solid #ff7a00; border-radius: 4px; padding: 6px 12px; background: #fff; font-size: 0.85rem; color: #ff7a00; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                                        🌌 Your Design Space
                                    </span>
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: space-between;">
                                    <div style="flex: 1; border: 1px solid #ddd; border-top: 3px solid #ff7a00; border-radius: 4px; padding: 10px; background: #fff; box-sizing: border-box;">
                                        <h4 style="margin: 0 0 6px 0; color: #ff7a00; font-size: 0.82rem; font-weight: 800; border-bottom: 1px solid #eee; padding-bottom: 2px; display: flex; align-items: center; gap: 4px;">🪚 1. The Workbench (Local Space)</h4>
                                        <p style="margin: 0 0 6px 0; font-size: 0.7rem; color: #666; font-style: italic;">Think of a single board lying flat on your workbench.</p>
                                        <ul style="margin: 0; padding-left: 14px; font-size: 0.7rem; line-height: 1.35; list-style-type: disc;">
                                            <li style="margin-bottom: 2px;"><strong>Board's own axes:</strong> Thickness (Y), Width (Z), Length (X) based on grain.</li>
                                            <li><strong>Cuts & grain are local:</strong> A miter or bevel cut moves with the board itself.</li>
                                        </ul>
                                    </div>
                                    <div style="flex: 1; border: 1px solid #ddd; border-top: 3px solid #3b82f6; border-radius: 4px; padding: 10px; background: #fff; box-sizing: border-box;">
                                        <h4 style="margin: 0 0 6px 0; color: #3b82f6; font-size: 0.82rem; font-weight: 800; border-bottom: 1px solid #eee; padding-bottom: 2px; display: flex; align-items: center; gap: 4px;">🏠 2. The Finished Room (World Space)</h4>
                                        <p style="margin: 0 0 6px 0; font-size: 0.7rem; color: #666; font-style: italic;">Think of assembling the piece inside a room.</p>
                                        <ul style="margin: 0; padding-left: 14px; font-size: 0.7rem; line-height: 1.35; list-style-type: disc;">
                                            <li style="margin-bottom: 2px;"><strong>Room's axes:</strong> Floor runs along X and Z; Height (Y) points straight up.</li>
                                            <li><strong>Assembly rotations:</strong> Components are tilted, splayed, and oriented relative to the floor.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            `;
                        } else {
                            html += `<pre style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; font-family: monospace; font-size: 0.9em; overflow-x: auto;"><code>${parseInline(codeLines.join('\n'))}</code></pre>`;
                        }
                        codeLines = [];
                        inCodeBlock = false;
                    } else {
                        inCodeBlock = true;
                        codeLang = trimmed.replace(/^```/, '').trim();
                    }
                    return;
                }

                if (inCodeBlock) {
                    codeLines.push(line);
                    return;
                }

                // Alert blocks starting with >
                if (trimmed.startsWith('>')) {
                    flushList();
                    inAlert = true;
                    const content = trimmed.substring(1).trim();
                    if (content.startsWith('[!')) {
                        const match = content.match(/\[!(.*?)\]/);
                        if (match) alertType = match[1];
                    } else {
                        alertLines.push(content);
                    }
                    return;
                } else {
                    flushAlert();
                }

                if (!trimmed) {
                    flushList();
                    return;
                }

                if (trimmed.startsWith('###')) {
                    flushList();
                    html += `<h3>${trimmed.replace(/^###\s+/, '')}</h3>`;
                } else if (trimmed.startsWith('##')) {
                    flushList();
                    html += `<h2>${trimmed.replace(/^##\s+/, '')}</h2>`;
                } else if (trimmed.startsWith('#')) {
                    flushList();
                    html += `<h1>${trimmed.replace(/^#\s+/, '')}</h1>`;
                } else if (trimmed === '---') {
                    flushList();
                    html += '<hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />';
                } else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    if (listType !== 'ul') {
                        flushList();
                        html += '<ul>';
                        listType = 'ul';
                    }
                    html += `<li>${parseInline(trimmed.replace(/^[*+-]\s+/, ''))}</li>`;
                } else if (/^\d+\./.test(trimmed)) {
                    const match = trimmed.match(/^(\d+)\./);
                    const num = match ? parseInt(match[1], 10) : 1;
                    if (listType !== 'ol') {
                        flushList();
                        html += `<ol start="${num}">`;
                        listType = 'ol';
                    }
                    html += `<li>${parseInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`;
                } else {
                    flushList();
                    html += `<p>${parseInline(trimmed)}</p>`;
                }
            });

            flushList();
            flushAlert();
            return html;
        };

        const printBodyHtml = mdToPrintHtml(rawManualText);

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sketch - User Manual & Woodworking Guide</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        line-height: 1.45;
                        color: #222;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px 10px;
                        background: #fff;
                        font-size: 0.88rem;
                    }
                    h1 {
                        text-align: center;
                        border-bottom: 2px solid #ff7a00;
                        padding-bottom: 8px;
                        margin-bottom: 15px;
                        color: #111;
                        font-size: 1.6rem;
                    }
                    h2 {
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 4px;
                        margin-top: 20px;
                        margin-bottom: 8px;
                        color: #ff7a00;
                        font-size: 1.25rem;
                    }
                    h3 {
                        color: #222;
                        margin-top: 12px;
                        margin-bottom: 6px;
                        font-size: 1.05rem;
                        border-left: 3px solid #ff7a00;
                        padding-left: 6px;
                    }
                    p {
                        margin-top: 0;
                        margin-bottom: 8px;
                    }
                    code {
                        background: #f5f5f5;
                        padding: 1px 4px;
                        border-radius: 4px;
                        font-family: SFMono-Regular, Consolas, Monaco, monospace;
                        font-size: 0.85em;
                        border: 1px solid #e0e0e0;
                    }
                    pre {
                        background: #f8f9fa;
                        padding: 10px;
                        border-radius: 6px;
                        overflow-x: auto;
                        border: 1px solid #e9ecef;
                        font-family: SFMono-Regular, Consolas, Monaco, monospace;
                        margin: 8px 0;
                    }
                    ul, ol {
                        padding-left: 20px;
                        margin-top: 0;
                        margin-bottom: 8px;
                    }
                    li {
                        margin-bottom: 4px;
                    }
                    .notice {
                        background: #fff9e6;
                        border-left: 4px solid #ffb300;
                        padding: 10px 12px;
                        margin: 12px 0;
                        border-radius: 4px;
                        page-break-inside: avoid;
                    }
                    .notice-title {
                        font-weight: bold;
                        color: #b27a00;
                        margin-bottom: 4px;
                        text-transform: uppercase;
                        font-size: 0.72rem;
                        letter-spacing: 0.5px;
                    }
                    @media print {
                        body {
                            padding: 0;
                            font-size: 0.82rem;
                        }
                        h1 { font-size: 1.4rem; margin-bottom: 12px; }
                        h2 { font-size: 1.15rem; margin-top: 15px; }
                        h3 { font-size: 0.95rem; margin-top: 10px; }
                        .notice { margin: 8px 0; }
                    }
                </style>
            </head>
            <body>
                ${printBodyHtml}
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Platform-independent Regex Markdown to React rendering engine
    const renderMarkdownToReact = (text) => {
        if (!text) return null;

        const lines = text.split(/\r?\n/);
        const elements = [];
        let listItems = [];
        let listType = null; // 'ul', 'ol', or null
        
        let inAlert = false;
        let alertType = '';
        let alertLines = [];

        let inCodeBlock = false;
        let codeLines = [];
        let codeLang = '';

        let listStartNum = 1;
        const flushList = (key) => {
            if (listItems.length > 0) {
                if (listType === 'ul') {
                    elements.push(<ul key={`ul-${key}`} style={{ paddingLeft: '22px', margin: '8px 0', listStyleType: 'disc' }}>{listItems}</ul>);
                } else if (listType === 'ol') {
                    elements.push(<ol key={`ol-${key}`} start={listStartNum} style={{ paddingLeft: '22px', margin: '8px 0', listStyleType: 'decimal' }}>{listItems}</ol>);
                }
                listItems = [];
                listType = null;
            }
        };

        const flushAlert = (key) => {
            if (inAlert) {
                const alertText = alertLines.join(' ');
                const label = alertType || 'NOTICE';
                elements.push(
                    <div key={`alert-${key}`} style={{
                        background: 'rgba(255, 122, 0, 0.04)',
                        borderLeft: '4px solid var(--accent-color)',
                        padding: '12px 18px',
                        borderRadius: '6px',
                        margin: '16px 0',
                        fontSize: '0.84rem',
                        border: '1px solid rgba(255, 122, 0, 0.15)',
                    }}>
                        <strong style={{ color: 'var(--accent-color)', textTransform: 'uppercase', fontSize: '0.72rem', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                            💡 {label}
                        </strong>
                        <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(alertText) }} />
                    </div>
                );
                alertLines = [];
                inAlert = false;
            }
        };

        const parseInlineMarkdown = (str) => {
            // Bold **text** styled to be highly distinct and vibrant
            let html = str.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 850; color: var(--accent-color, #ff7a00);">$1</strong>');
            // Inline code `code`
            html = html.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.06); padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border-color); font-family: monospace; font-size: 0.85em; color: var(--accent-color);">$1</code>');
            return html;
        };

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Code Blocks Handling
            if (trimmed.startsWith('```')) {
                flushList(index);
                flushAlert(index);
                if (inCodeBlock) {
                    const codeText = codeLines.join('\n');
                    if (codeLang === 'mermaid') {
                        elements.push(
                            <div key={`mermaid-${index}`} style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '24px',
                                margin: '24px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '20px',
                                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                                backdropFilter: 'blur(4px)'
                            }}>
                                {/* Overarching Design Space */}
                                <div style={{
                                    background: 'linear-gradient(135deg, var(--accent-color, #ff7a00) 0%, #ff5100 100%)',
                                    color: '#fff',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '0.95rem',
                                    textAlign: 'center',
                                    boxShadow: '0 4px 15px rgba(255, 122, 0, 0.3)',
                                    letterSpacing: '0.5px',
                                    minWidth: '220px'
                                }}>
                                    🌌 Your Design Space
                                </div>

                                {/* Dynamic Connecting Line / Arrow */}
                                <div style={{
                                    height: '24px',
                                    width: '2px',
                                    background: 'linear-gradient(to bottom, var(--accent-color) 0%, rgba(255, 255, 255, 0.2) 100%)'
                                }}></div>

                                {/* Columns Container */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                    gap: '24px',
                                    width: '100%'
                                }}>
                                    {/* Column 1: The Workbench */}
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 122, 0, 0.15)',
                                        borderRadius: '8px',
                                        padding: '18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            color: 'var(--accent-color)',
                                            fontWeight: '700',
                                            fontSize: '0.9rem',
                                            borderBottom: '1px solid rgba(255, 122, 0, 0.2)',
                                            paddingBottom: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            🪚 1. The Workbench (Local Space)
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            Think of a single board lying flat on your workbench.
                                        </p>
                                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-main)', listStyleType: 'disc' }}>
                                            <li><strong>Board's own axes:</strong> Thickness (Y), Width (Z), Length (X) based on grain.</li>
                                            <li><strong>Cuts & grain are local:</strong> A miter or bevel cut moves with the board itself.</li>
                                        </ul>
                                    </div>

                                    {/* Column 2: The Finished Room */}
                                    <div style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(59, 130, 246, 0.15)',
                                        borderRadius: '8px',
                                        padding: '18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            color: '#3b82f6',
                                            fontWeight: '700',
                                            fontSize: '0.9rem',
                                            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                                            paddingBottom: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            🏠 2. The Finished Room (World Space)
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            Think of assembling the piece inside a room.
                                        </p>
                                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-main)', listStyleType: 'disc' }}>
                                            <li><strong>Room's axes:</strong> Floor runs along X and Z; Height (Y) points straight up.</li>
                                            <li><strong>Assembly rotations:</strong> Components are tilted, splayed, and oriented relative to the floor.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        );
                    } else {
                        elements.push(
                            <pre key={`code-${index}`} style={{
                                background: 'rgba(0,0,0,0.2)',
                                padding: '12px',
                                borderRadius: '6px',
                                fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                                fontSize: '0.76rem',
                                overflowX: 'auto',
                                border: '1px solid var(--border-color)',
                                margin: '10px 0',
                                color: '#ddd'
                            }}>
                                <code>{codeText}</code>
                            </pre>
                        );
                    }
                    codeLines = [];
                    inCodeBlock = false;
                } else {
                    inCodeBlock = true;
                    codeLang = trimmed.replace(/^```/, '').trim();
                }
                return;
            }

            if (inCodeBlock) {
                codeLines.push(line);
                return;
            }

            // Alerts / Callouts (starting with >)
            if (trimmed.startsWith('>')) {
                flushList(index);
                inAlert = true;
                const content = trimmed.substring(1).trim();
                if (content.startsWith('[!')) {
                    const match = content.match(/\[!(.*?)\]/);
                    if (match) {
                        alertType = match[1];
                    }
                } else {
                    alertLines.push(content);
                }
                return;
            } else {
                flushAlert(index);
            }

            // Empty lines
            if (!trimmed) {
                flushList(index);
                return;
            }

            // Headers
            if (trimmed.startsWith('###')) {
                flushList(index);
                const title = trimmed.replace(/^###\s+/, '');
                elements.push(
                    <h3 key={`h3-${index}`} style={{ margin: '20px 0 10px 0', fontSize: '1.05rem', color: 'var(--accent-color)', borderLeft: '3px solid var(--accent-color)', paddingLeft: '8px', fontWeight: 600 }}>
                        {title}
                    </h3>
                );
            } else if (trimmed.startsWith('##')) {
                flushList(index);
                const title = trimmed.replace(/^##\s+/, '');
                elements.push(
                    <h2 key={`h2-${index}`} style={{ margin: '26px 0 12px 0', fontSize: '1.25rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', fontWeight: 600 }}>
                        {title}
                    </h2>
                );
            } else if (trimmed.startsWith('#')) {
                flushList(index);
                const title = trimmed.replace(/^#\s+/, '');
                elements.push(
                    <h1 key={`h1-${index}`} style={{ margin: '0 0 16px 0', fontSize: '1.45rem', color: 'var(--text-main)', borderBottom: '2px solid var(--accent-color)', paddingBottom: '8px', fontWeight: 700 }}>
                        {title}
                    </h1>
                );
            }
            // Horizontal rule
            else if (trimmed === '---') {
                flushList(index);
                elements.push(<hr key={`hr-${index}`} style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />);
            }
            // Unordered List Items
            else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                if (listType !== 'ul') {
                    flushList(index);
                    listType = 'ul';
                }
                const content = trimmed.replace(/^[*+-]\s+/, '');
                listItems.push(<li key={`li-${index}`} style={{ marginBottom: '6px', fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(content) }} />);
            }
            // Ordered List Items
            else if (/^\d+\./.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\./);
                const num = match ? parseInt(match[1], 10) : 1;
                if (listType !== 'ol') {
                    flushList(index);
                    listType = 'ol';
                    listStartNum = num;
                }
                const content = trimmed.replace(/^\d+\.\s+/, '');
                listItems.push(<li key={`li-${index}`} style={{ marginBottom: '6px', fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(content) }} />);
            }
            // General paragraphs
            else {
                flushList(index);
                elements.push(
                    <p key={`p-${index}`} style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: 'var(--text-main)', opacity: 0.95 }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed) }} />
                );
            }
        });

        flushList(lines.length);
        flushAlert(lines.length);

        return elements;
    };

    return (
        <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0, padding: '20px' }} onClick={() => setShowUserManualDialog(false)}>
            <div className="glass-panel" style={{ padding: '0', maxWidth: '950px', width: '100%', height: '85vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', color: 'var(--text-main)', position: 'relative', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                
                {/* Header card with action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--panel-bg, #1a1e24)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📖</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>Sketch User Guide</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tailored specifically for woodworkers</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="nav-btn" onClick={handleDownload} style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--accent-color)', color: 'var(--accent-color)', background: 'rgba(255, 122, 0, 0.05)' }} title="Download manual as a markdown file for offline reading">
                            📥 Download (.md)
                        </button>
                        <button className="nav-btn primary" onClick={handlePrint} style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--accent-color)', color: '#fff', border: 'none' }} title="Print manual with clean printer-friendly styling">
                            🖨️ Print Guide
                        </button>
                        <button className="nav-btn" onClick={() => setShowUserManualDialog(false)} style={{ width: '28px', height: '28px', minWidth: 'auto', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0, fontSize: '1.1rem', cursor: 'pointer' }}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Split layout: sidebar navigation on left, scrollable content on right */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    
                    {/* Left Sidebar tabs */}
                    <div style={{ width: '220px', borderRight: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                        <button 
                            onClick={() => setActiveSection('quickstart')}
                            style={{
                                textAlign: 'left', padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                background: activeSection === 'quickstart' ? 'var(--accent-color)' : 'transparent',
                                color: activeSection === 'quickstart' ? '#fff' : 'var(--text-main)'
                            }}
                        >
                            🚀 1. Quick Start Tutorial
                        </button>
                        <button 
                            onClick={() => setActiveSection('coordinates')}
                            style={{
                                textAlign: 'left', padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                background: activeSection === 'coordinates' ? 'var(--accent-color)' : 'transparent',
                                color: activeSection === 'coordinates' ? '#fff' : 'var(--text-main)'
                            }}
                        >
                            📐 2. Local vs. World Space
                        </button>
                        <button 
                            onClick={() => setActiveSection('cuts')}
                            style={{
                                textAlign: 'left', padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                background: activeSection === 'cuts' ? 'var(--accent-color)' : 'transparent',
                                color: activeSection === 'cuts' ? '#fff' : 'var(--text-main)'
                            }}
                        >
                            🪚 3. Miters and Bevels
                        </button>
                        <button 
                            onClick={() => setActiveSection('troubleshooting')}
                            style={{
                                textAlign: 'left', padding: '10px 14px', borderRadius: '8px', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                background: activeSection === 'troubleshooting' ? 'var(--accent-color)' : 'transparent',
                                color: activeSection === 'troubleshooting' ? '#fff' : 'var(--text-main)'
                            }}
                        >
                            🔧 4. Pro-Tips & Support
                        </button>
                    </div>

                    {/* Right Scrollable Content panel */}
                    <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: 'var(--panel-bg)', lineStyleType: 'none', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
                        
                        <div style={{ flex: 1 }}>
                            {activeSection === 'quickstart' && (
                                <div>
                                    {renderMarkdownToReact(welcomeMarkdown)}
                                    {renderMarkdownToReact(quickstartMarkdown)}
                                </div>
                            )}

                            {activeSection === 'coordinates' && (
                                <div>
                                    {renderMarkdownToReact(coordinatesMarkdown)}
                                </div>
                            )}

                            {activeSection === 'cuts' && (
                                <div>
                                    {renderMarkdownToReact(cutsMarkdown)}
                                </div>
                            )}

                            {activeSection === 'troubleshooting' && (
                                <div>
                                    {renderMarkdownToReact(troubleshootingMarkdown)}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Technical Diagnostics Footer */}
                <div style={{
                    padding: '8px 24px',
                    background: 'rgba(0,0,0,0.25)',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '0.66rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'monospace'
                }}>
                    <span>📄 Path: apps/sketch/docs/user_manual.md</span>
                    <span>Length: {rawManualText?.length || 0} chars | Sections detected: {parts.length}</span>
                </div>

            </div>
        </div>
    );
};

export default UserManualDialog;
