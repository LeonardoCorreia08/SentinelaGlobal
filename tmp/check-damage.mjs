import { readFileSync } from 'fs';
const c = readFileSync('src/lib/api-mundiais.ts', 'utf8');
const lines = c.split('\n');
console.log('Total lines:', lines.length);
// Show lines 530-580
for (let i = Math.max(0, 530); i < Math.min(lines.length, 580); i++) {
  console.log((i+1) + ': ' + lines[i]);
}
