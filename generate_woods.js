import fs from 'fs';
const dir = './public/textures';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const woods = {
  'pine': { base: '#f4e4c1', contrast: 0.15 },
  'cherry': { base: '#c96447', contrast: 0.20 },
  'walnut': { base: '#704832', contrast: 0.12 },
  'red-oak': { base: '#d48d75', contrast: 0.20 },
  'white-oak': { base: '#e6d5b8', contrast: 0.25 }
};

for (const [name, props] of Object.entries(woods)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="100%" height="100%" fill="${props.base}" />
    <filter id="wood">
      <feTurbulence type="fractalNoise" baseFrequency="0.005 0.25" numOctaves="4" result="noise" />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${props.contrast} 0" in="noise" result="coloredNoise" />
    </filter>
    <rect width="100%" height="100%" filter="url(#wood)"/>
  </svg>`;
  fs.writeFileSync(`${dir}/${name}.svg`, svg);
}
console.log('Wood textures generated!');
