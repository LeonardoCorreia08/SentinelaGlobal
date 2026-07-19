import { readFileSync } from 'node:fs';

const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

for(let i = 2100; i < 2115 && i < lines.length; i++) {
  if(lines[i].includes('maxItens')) {
    console.log(`${i}: "${lines[i]}"`);
    console.log(`  chars: ${JSON.stringify(lines[i])}`);
  }
}
