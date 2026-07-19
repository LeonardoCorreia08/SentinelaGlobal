import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
console.log('=== SECTION 1930-1945 ===');
for (let i = 1930; i < 1945 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
console.log('\n=== SECTION 1975-1992 ===');
for (let i = 1975; i < 1992 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
console.log('\n=== SECTION 2000-2020 ===');
for (let i = 2000; i < 2020 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
console.log('\n=== SECTION 2055-2065 ===');
for (let i = 2055; i < 2065 && i < lines.length; i++) {
  console.log(JSON.stringify(lines[i]));
}
