import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// Find and remove the UNREACHABLE salvarCache after the manual return in Groq function
// The pattern is: return { ... manual fallback ... }; followed by salvarCache(...)
// We need to remove the salvarCache block that comes after the return

// First attempt: look for the specific pattern
const oldBlock = `        return {
          resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Análise Groq concluída.",
          analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
          recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
          tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando") as AnaliseLLM["tendencia"],
          nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media") as AnaliseLLM["nivel_confianca"],
          modelo_utilizado: "Groq Llama 3 (Convex Action)",
          fontes_analisadas: dados.fontes_ativas,
        };
        salvarCache(
          {
            resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Analise Groq concluida.",
            analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
            recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r) => typeof r === "string") : [],
            tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando"),
            nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media"),
            modelo_utilizado: "Groq Llama 3 (Convex Action)",
            fontes_analisadas: dados.fontes_ativas,
          },
          dados.risco_geral
        );`;

const newBlock = `        return {
          resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Análise Groq concluída.",
          analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
          recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
          tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando") as AnaliseLLM["tendencia"],
          nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media") as AnaliseLLM["nivel_confianca"],
          modelo_utilizado: "Groq Llama 3 (Convex Action)",
          fontes_analisadas: dados.fontes_ativas,
        };`;

if (c.includes(oldBlock)) {
  c = c.replace(oldBlock, newBlock);
  console.log('Fixed unreachable salvarCache after manual return');
} else {
  console.log('Pattern not found - checking for alternative...');
  // Check if the malformed code exists
  const idx = c.indexOf('salvarCache(');
  if (idx >= 0) {
    console.log('Found salvarCache at position', idx);
    // Check context
    console.log(c.substring(idx - 100, idx + 100));
  }
}

writeFileSync(path, c, 'utf8');

// Fix: also make sure the block after it is correctly structured
// The logDebug line after has wrong indentation - should be inside the else of if(convexClient)
// But the original had: logDebug("Convex action grokAction falhou", result); inside the if block
// After we removed the unreachable code, it should be fine.

console.log('Done fixing syntax');
