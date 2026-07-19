import { readFileSync } from 'fs';
const c = readFileSync('src/lib/llm-service.ts', 'utf8');
const lines = c.split('\n');
for (let i = 428; i < 446 && i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
