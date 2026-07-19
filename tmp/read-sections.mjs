import { readFileSync } from 'node:fs';

const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

// Read CATEGORIAS_NOTICIAS definition (around line 801)
console.log('=== CATEGORIAS_NOTICIAS (line 795-830) ===');
for(let i = 795; i < Math.min(830, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

// Read categoriasExpandidas state (around line 852)
console.log('\n\n=== categoriasExpandidas state (line 845-860) ===');
for(let i = 845; i < Math.min(860, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

// Read noticiasReais population (around line 1100-1150)
console.log('\n\n=== noticiasReais / setNoticias (line 1095-1150) ===');
for(let i = 1095; i < Math.min(1150, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

// Read the filtering/display logic (around line 2095-2120)
console.log('\n\n=== Categorias display (line 2090-2130) ===');
for(let i = 2090; i < Math.min(2130, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

// Read the noticiasExpandidas toggle (line 2185-2210)
console.log('\n\n=== noticiasExpandidas toggle (line 2185-2210) ===');
for(let i = 2185; i < Math.min(2210, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);
