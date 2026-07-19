import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// Find the analisarComGroqDireto function and rewrite it entirely
// The current function has a missing closing brace for if(result.success)

// Find where the function starts
const funcStart = c.indexOf('async function analisarComGroqDireto(');
if (funcStart < 0) { console.log('ERROR: function not found'); process.exit(1); }

// Find where the function ends - look for the next function or section
const funcEndMatch = c.indexOf('\n/** Obtém referência ao ConvexHttpClient');
if (funcEndMatch < 0) { console.log('ERROR: end marker not found'); process.exit(1); }

const funcEnd = funcEndMatch + 1; // include the newline

// The correct function to replace with
const newFunc = `async function analisarComGroqDireto(
  dados: DadosParaAnalise,
): Promise<AnaliseLLM | null> {
  try {
    const eventosText = dados.eventos_proximos
      .map(
        (e) =>
          \`- \${e.tipo} (severidade \${e.severidade}/5, \${e.distancia_km.toFixed(0)}km, impacto \${e.impacto.toFixed(0)}%, fonte: \${e.fonte})\`,
      )
      .join("\\n");

    const systemPrompt = \`Você é o SentinelaGlobal, analista de riscos de desastres naturais.\` +
      ' Retorne APENAS um JSON com campos: resumo_executivo (string curta),' +
      ' analise_detalhada (string), recomendacoes (array strings),' +
      ' tendencia (aumentando/estabilizando/diminuindo),' +
      ' nivel_confianca (alta/media/baixa).' +
      ' IMPORTANTE: resumo_executivo DEVE ser string, NUNCA objeto.' +
      ' Cite fontes (USGS, GDACS, INMET, NOAA, Copernicus, NASA FIRMS).' +
      ' Responda em português brasileiro. Sem prefácio nem comentários.';

    const userPrompt = \`Risco: \${dados.risco_geral.toFixed(0)}% (\${dados.nivel_alerta})\\nFontes: \${dados.fontes_ativas.join(", ")}\\nEventos:\\n\${eventosText || "Nenhum"}\\nTemp: \${dados.temperatura_c ?? "N/A"}°C, Chuva: \${dados.precipitacao_mm ?? "N/A"}mm, Vento: \${dados.vento_kmh ?? "N/A"} km/h\`;

    logDebug("Chamando API Groq via Convex Action (server-side)", {
      modelo: "llama-3.3-70b-versatile",
      total_eventos: dados.eventos_proximos.length,
    });

    // Tenta Convex action (server-side, sem expor chave)
    const convexClient = await getConvexClientRef();
    if (convexClient) {
      const { api } = await import("../convex/_generated/api");
      const result = await convexClient.action(api.proxyApi.grokAction, {
        systemPrompt,
        userPrompt,
      });

      if (result.success && result.data) {
        const validado = validarAnaliseLLM(result.data, "Groq Llama 3 (Convex Action)", dados.fontes_ativas);
        if (validado) {
          salvarCache(validado, dados.risco_geral);
          return validado;
        }

        // Fallback manual se validacao falhar
        salvarCache(
          {
            resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Analise Groq concluida.",
            analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
            recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
            tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando") as AnaliseLLM["tendencia"],
            nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media") as AnaliseLLM["nivel_confianca"],
            modelo_utilizado: "Groq Llama 3 (Convex Action)",
            fontes_analisadas: dados.fontes_ativas,
          },
          dados.risco_geral,
        );
        return {
          resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Analise Groq concluida.",
          analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
          recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
          tendencia: (typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando") as AnaliseLLM["tendencia"],
          nivel_confianca: (typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media") as AnaliseLLM["nivel_confianca"],
          modelo_utilizado: "Groq Llama 3 (Convex Action)",
          fontes_analisadas: dados.fontes_ativas,
        };
      }

      logDebug("Convex action grokAction falhou", result);
    } else {
      logDebug("Convex client nao disponivel", {});
    }

    return null;
  } catch (err) {
    logErro("Excecao ao chamar Groq via Convex Action", err);
    return null;
  }
}`;

// Replace the old function with the new one
const before = c.substring(0, funcStart);
const after = c.substring(funcEnd);
c = before + newFunc + after;

writeFileSync(path, c, 'utf8');
console.log('Done! Function rewritten with correct structure');

// Verify no syntax issues
const verify = readFileSync(path, 'utf8');
// Count braces
let opens = 0, closes = 0;
for (const ch of verify) {
  if (ch === '{') opens++;
  if (ch === '}') closes++;
}
console.log('Braces:', opens, 'open,', closes, 'close,', opens === closes ? 'BALANCED!' : 'MISMATCH!');
