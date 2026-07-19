import { readFileSync } from 'fs';
const content = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
// Print 2280-2520 (full map sections)
for (let i = 2280; i < Math.min(lines.length, 2520); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
