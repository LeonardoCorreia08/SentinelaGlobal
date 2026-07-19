import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

console.log('=== Lines 1932-1943 (Header) ===');
for (let i = 1932; i < 1943 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}

console.log('\n=== Lines 1975-1992 (Badge) ===');
for (let i = 1975; i < 1992 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
