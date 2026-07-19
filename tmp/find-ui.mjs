import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = c.split('\n');
const kws = ['modeloLLM', 'fontes_ativas', 'BrainCircuit', 'insightsAbertos', 'analiseLLM', 'fontes'];
for (let i = 0; i < lines.length; i++) {
  for (const kw of kws) {
    if (lines[i].includes(kw)) {
      console.log((i + 1) + ': ' + lines[i].trim());
      break;
    }
  }
}
