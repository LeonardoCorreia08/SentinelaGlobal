import { readFileSync } from 'fs';
const content = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
// Print lines 2310-2510 (map sections)
for (let i = 2310; i < Math.min(lines.length, 2510); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
