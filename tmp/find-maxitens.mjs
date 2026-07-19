import { readFileSync } from 'node:fs';

const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

for(let i = 0; i < lines.length; i++) {
  if(lines[i].includes('maxItens')) {
    console.log(`${i}: ${JSON.stringify(lines[i])}`);
  }
}
