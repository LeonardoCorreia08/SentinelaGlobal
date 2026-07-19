import { readFileSync } from 'fs';
const content = readFileSync('src/lib/api-mundiais.ts', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
// Print last 200 lines
for (let i = Math.max(0, lines.length - 200); i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
