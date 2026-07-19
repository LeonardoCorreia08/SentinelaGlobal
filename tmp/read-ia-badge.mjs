import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
console.log('=== IA BADGE LINES ===');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('IA:')) {
    // Print this line + the next 8 lines to capture full badge
    for (let j = i; j < i + 10 && j < lines.length; j++) {
      console.log(JSON.stringify(lines[j]));
    }
    break;
  }
}
