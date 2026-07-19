import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
for (let i = 1915; i < 2075 && i < lines.length; i++) {
  console.log((i + 1) + ' ' + lines[i]);
}
