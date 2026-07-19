import { readFileSync } from 'node:fs';

// Check the eventosReais / noticiasReais pipeline (around line 1070-1110)
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

console.log('=== Pipeline: eventosReais → noticiasReais (line 1070-1150) ===');
for(let i = 1065; i < Math.min(1160, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

console.log('\n\n=== NoticiasExpandidas state & toggle (line 845-860) ===');
for(let i = 845; i < Math.min(865, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

console.log('\n\n=== noticiasExpandidas toggle (line 2070-2100) ===');
for(let i = 2070; i < Math.min(2110, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

console.log('\n\n=== Full CATEGORIAS_NOTICIAS (line 795-825) ===');
for(let i = 795; i < Math.min(825, lines.length); i++) console.log(`${i+1}: ${lines[i]}`);

// Check llm-service.ts for Groq key usage
console.log('\n\n=== === llm-service.ts ===');
const llm = readFileSync('src/lib/llm-service.ts', 'utf8');
const llmLines = llm.split('\n');
console.log('Total lines:', llmLines.length);
for(let i = 0; i < llmLines.length; i++) {
  const line = llmLines[i];
  if(line.includes('GROQ') || line.includes('groq') || line.includes('apiKey') || 
     line.includes('VITE_GROQ') || line.includes('VITE_') ||
     line.includes('freebuff') || line.includes('import.meta')) {
    console.log(`${i+1}: ${line}`);
  }
}
