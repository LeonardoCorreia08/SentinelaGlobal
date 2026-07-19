import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
console.log('=== LINES 1925-1995 ===');
for (let i = 1925; i < 1995 && i < lines.length; i++) {
  console.log((i + 1) + ' ' + lines[i]);
}
console.log('\n=== LINES 2050-2070 ===');
for (let i = 2050; i < 2070 && i < lines.length; i++) {
  console.log((i + 1) + ' ' + lines[i]);
}
