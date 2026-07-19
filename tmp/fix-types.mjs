import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// Fix line 436: tendencia type casting
c = c.replace(
  'tendencia: typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando"',
  'tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando") as AnaliseLLM["tendencia"]'
);

// Fix line 437: nivel_confianca type casting
c = c.replace(
  'nivel_confianca: typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media"',
  'nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media") as AnaliseLLM["nivel_confianca"]'
);

writeFileSync(path, c, 'utf8');
console.log('✅ Type casts applied');
