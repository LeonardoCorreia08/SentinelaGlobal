import { readFileSync } from 'node:fs';

const c = readFileSync('/home/project/src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

console.log('=== Lines with CATEGORIAS_NOTICIAS, categoriasExpandidas, noticiasReais, setNoticias, Groq, analisar ===\n');

for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if(line.includes('CATEGORIAS_NOTICIAS') || line.includes('categoriasExpandidas') ||
     line.includes('noticiasReais') || line.includes('setNoticias') ||
     line.includes('Groq') || line.includes('analisar') ||
     line.includes('noticias.slice') || line.includes('noticias.sort') ||
     line.includes('noticias.map')) {
    console.log(`${i+1}: ${line}`);
  }
}
