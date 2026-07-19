import { readFileSync } from 'node:fs';

const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

// Show pipeline block with line numbers
console.log('=== Pipeline block (1104-1142) ===');
for(let i = 1104; i < 1142 && i < lines.length; i++) {
  console.log(`${i}: ${lines[i]}`);
}

console.log('\n\n=== Display block (2098-2135) ===');
for(let i = 2098; i < 2135 && i < lines.length; i++) {
  console.log(`${i}: ${lines[i]}`);
}
