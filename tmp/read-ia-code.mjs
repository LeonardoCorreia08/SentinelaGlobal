import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
// Find the IA: line
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('IA:')) {
    for (let j = i; j < i + 12 && j < lines.length; j++) {
      console.log(JSON.stringify(lines[j]));
    }
    console.log('---');
    break;
  }
}
