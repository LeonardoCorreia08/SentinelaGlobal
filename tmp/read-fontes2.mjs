import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
console.log('=== LINES 1962-1985 (EXACT fontes badges + IA badge) ===');
for (let i = 1962; i < 1985 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
