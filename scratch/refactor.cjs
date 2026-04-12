const fs = require('fs');
const file = 'd:/Antigravity Dev/Sketch/src/App.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const startIdx1 = lines.findIndex(l => l.includes('// ── File I/O'));
const endIdx1 = lines.findIndex(l => l.includes('const handleDragOver ='));

const startIdx2 = lines.findIndex(l => l.includes('const dropGroupToFloor ='));
const endIdx2 = lines.findIndex(l => l.includes('// Apply theme on initial mount'));

const startIdx3 = lines.findIndex(l => l.includes('const manualAddBoard ='));
const endIdx3 = lines.findIndex(l => l.includes('return (') && lines.indexOf(l) > startIdx3);

console.log({ startIdx1, endIdx1, startIdx2, endIdx2, startIdx3, endIdx3 });

const newLines = [
    ...lines.slice(0, startIdx1),
    ...lines.slice(endIdx1, startIdx2),
    ...lines.slice(endIdx2, startIdx3),
    ...lines.slice(endIdx3)
];

fs.writeFileSync(file, newLines.join('\n'));
console.log('App.jsx successfully refactored.');
