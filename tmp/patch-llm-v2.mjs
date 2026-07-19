import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

const startMarker = '// ═════════════════════════════════════════════════════════════════════\n//  TENTATIVA DIRETA À API GROQ (fallback se freebuff não disponível)';
const endMarker = '// ═════════════════════════════════════════════════════════════════════\n//  FALLBACK — Análise Local Simulada';

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('❌ Could not find markers. Looking for alternatives...');
  const altStart = c.indexOf('TENTATIVA DIRETA À API GROQ');
  const altEnd = c.indexOf('FALLBACK — Análise Local Simulada');
  if (altStart >= 0 && altEnd >= 0) {
    console.log(`Found at ${altStart} -> ${altEnd}`);
    // Find the comment block start before this
    const commentStart = c.lastIndexOf('// ════', altStart - 50);
    if (commentStart >= 0) {
      console.log(`Line range: lines ${c.substring(0, commentStart).split('\n').length} to ${c.substring(0, altEnd).split('\n').length}`);
    }
  }
  process.exit(1);
}

const before = c.substring(0, startIdx);
const after = c.substring(endIdx);

const replacement = `// ═════════════════════════════════════════════════════════════════════
//  TENTATIVA VIA CONVEX ACTION (server-side, sem expor chave)
// ═════════════════════════════════════════════════════════════════════

/**
 * Tenta chamar a API Groq via Convex Action (server-side, sem expor chave).
 * A chave GROQ_API_KEY fica apenas no servidor Convex, nunca no bundle JS.
 */
async function analisarComGroqDireto(
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
        if (validado) return validado;

        // Fallback manual se validação falhar
        return {
          resumo_executivo: typeof result.data.resumo_executivo === "string" ? result.data.resumo_executivo : "Análise Groq concluída.",
          analise_detalhada: typeof result.data.analise_detalhada === "string" ? result.data.analise_detalhada : "",
          recomendacoes: Array.isArray(result.data.recomendacoes) ? result.data.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
          tendencia: typeof result.data.tendencia === "string" ? result.data.tendencia : "estabilizando",
          nivel_confianca: typeof result.data.nivel_confianca === "string" ? result.data.nivel_confianca : "media",
          modelo_utilizado: "Groq Llama 3 (Convex Action)",
          fontes_analisadas: dados.fontes_ativas,
        };
      }

      logDebug("Convex action grokAction falhou", result);
    } else {
      logDebug("Convex client não disponível", {});
    }

    return null;
  } catch (err) {
    logErro("Exceção ao chamar Groq via Convex Action", err);
    return null;
  }
}

/** Obtém referência ao ConvexHttpClient (singleton) */
let _convexClient: import("convex/browser").ConvexHttpClient | null = null;

async function getConvexClientRef() {
  if (_convexClient) return _convexClient;
  const url = typeof import.meta !== "undefined"
    ? (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CONVEX_URL
    : undefined;
  if (!url) return null;
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    _convexClient = new ConvexHttpClient(url);
    return _convexClient;
  } catch {
    return null;
  }
}\n\n`;

c = before + replacement + after;
writeFileSync(path, c, 'utf8');

const linesBefore = c.substring(0, startIdx).split('\n').length;
console.log('✅ Groq function replaced via Convex Action');
console.log(`Replaced from line ~${linesBefore}`);
console.log(`Total lines: ${c.split('\n').length}`);
