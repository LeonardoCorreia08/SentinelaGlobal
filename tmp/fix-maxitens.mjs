import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/pages/SentinelaDashboard.tsx';
let content = readFileSync(path, 'utf8');

// Replace maxItens values 
content = content.replace(
  /const maxItens = expandido \? 100 : 3;/,
  'const maxItens = expandido ? 15 : 5;'
);

writeFileSync(path, content, 'utf8');
console.log('Done! Replaced maxItens values.');

// Verify
const after = readFileSync(path, 'utf8');
const lines = after.split('\n');
for(let i = 0; i < lines.length; i++) {
  if(lines[i].includes('maxItens')) {
    console.log(`${i}: ${lines[i]}`);
  }
}
