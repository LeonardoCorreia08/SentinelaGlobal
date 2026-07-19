import { readFileSync } from 'node:fs';

// Find news-related code in SentinelaDashboard
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');

console.log('=== News categorization and display code ===\n');

// Find all relevant sections
const keywords = [
  'CATEGORIAS_NOTICIAS',
  'categoriasExpandidas',
  'noticiasExpandidas',
  'noticias.map',
  'noticiasReais',
  'setNoticias',
  'evento.tipo',
  'noticias.slice',
  'noticias.sort',
  '.tipo ===',
  'cat.tipo',
  'severidade'
];

for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for(const kw of keywords) {
    if(line.includes(kw)) {
      console.log(`${i+1}: ${line}`);
      break;
    }
  }
}

// Also find llm-service usage
console.log('\n\n=== LLM/Groq/analisar references ===');
for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if(line.includes('analisar') || line.includes('Groq') || line.includes('LLM') || line.includes('analise')) {
    console.log(`${i+1}: ${line}`);
  }
}

// Find where noticias is set/populated
console.log('\n\n=== Where noticiasReais is populated ===');
const noticiasStart = c.indexOf('noticiasReais');
if(noticiasStart >= 0) {
  console.log(c.substring(noticiasStart, noticiasStart + 800));
}
