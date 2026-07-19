import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
console.log('=== Lines 1960-1995 (fontes badges + IA badge area) ===');
for (let i = 1960; i < 1995 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
