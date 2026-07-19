import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// 1) Replace the direct Groq fetch function with Convex action version
const oldGroqFunc = `/**
 * Tenta chamar a API Groq diretamente do navegador.
 * A chave GROQ_API_KEY é injetada pelo Freebuff Web no build,
 * mas pode não estar acessível via import.meta.env no runtime.
 */
async function analisarComGroqDireto(
  dados: DadosParaAnalise,
): Promise<AnaliseLLM | null> {
  try {
    // Tenta acessar a chave — verifica VITE_GROQ_API_KEY e GROQ_API_KEY
    // No Freebuff Web, adicione a chave como VITE_GROQ_API_KEY no painel Keys
    let groqKey: string | null = null;
    try {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      if (env) {
        groqKey = env.VITE_GROQ_API_KEY || (env as Record<string, string | undefined>).GROQ_API_KEY || null;
      }
    } catch {
      // import.meta.env não disponível
    }

    if (!groqKey || typeof groqKey !== "string") {
      logDebug("GROQ_API_KEY não encontrada no import.meta.env", { keyDisponivel: false });
      return null;
    }

    const eventosText = dados.eventos_proximos
      .map(
        (e) =>
          \`- \${e.tipo} (severidade \${e.severidade}/5, \${e.distancia_km.toFixed(0)}km, impacto \${e.impacto.toFixed(0)}%, fonte: \${e.fonte})\`,
      )
      .join("\\n");

    logDebug("Chamando API Groq diretamente", {
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      modelo: "llama-3.3-70b-versatile",
      response_format: "json_object",
      total_eventos: dados.eventos_proximos.length,
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${groqKey}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: 'Você é o SentinelaGlobal, analista de riscos de desastres naturais.' +
              ' Retorne APENAS um JSON com campos: resumo_executivo (string curta),' +
              ' analise_detalhada (string), recomendacoes (array strings),' +
              ' tendencia (aumentando/estabilizando/diminuindo),' +
              ' nivel_confianca (alta/media/baixa).' +
              ' IMPORTANTE: resumo_executivo DEVE ser string, NUNCA objeto.' +
              ' Cite fontes (USGS, GDACS, INMET, NOAA, Copernicus, NASA FIRMS).' +
              ' Responda em português brasileiro. Sem prefácio nem comentários.',
          },
          {
            role: "user",
            content: \`Risco: \${dados.risco_geral.toFixed(0)}% (\${dados.nivel_alerta})\\\\nFontes: \${dados.fontes_ativas.join(", ")}\\nEventos:\\n\${eventosText || "Nenhum"}\\nTemp: \${dados.temperatura_c ?? "N/A"}°C, Chuva: \${dados.precipitacao_mm ?? "N/A"}mm, Vento: \${dados.vento_kmh ?? "N/A"} km/h\`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      logErro(\`API Groq retornou HTTP \${response.status}\`, { status: response.status, statusText: response.statusText });
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    logDebug("Resposta bruta da API Groq", { hasContent: !!content, choicesLength: data.choices?.length });

    if (!content) {
      logErro("API Groq retornou resposta sem conteúdo", data);
      return null;
    }

    const parsed = JSON.parse(content);

    // Valida com Zod
    const validado = validarAnaliseLLM(parsed, "Groq Llama 3 (API direta)", dados.fontes_ativas);
    if (validado) {
      return validado;
    }

    // Fallback se Zod falhar — garante que todos os campos sejam do tipo correto
    logDebug("Fallback: parsing manual sem Zod", {});
    return {
      resumo_executivo: typeof parsed.resumo_executivo === "string" ? parsed.resumo_executivo : "Análise Groq concluída.",
      analise_detalhada: typeof parsed.analise_detalhada === "string" ? parsed.analise_detalhada : "",
      recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes.filter((r: unknown): r is string => typeof r === "string") : [],
      tendencia: typeof parsed.tendencia === "string" ? parsed.tendencia : "estabilizando",
      nivel_confianca: typeof parsed.nivel_confianca === "string" ? parsed.nivel_confianca : "media",
      modelo_utilizado: "Groq Llama 3 (API direta) — fallback",
      fontes_analisadas: dados.fontes_ativas,
    };
  } catch (err) {
    logErro("Exceção ao chamar API Groq", err);
    return null;
  }
}`;

const newGroqFunc = `/**
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

    // Tenta Convex action primeiro
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

        // Fallback manual
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
}`;

if (c.includes(oldGroqFunc)) {
  c = c.replace(oldGroqFunc, newGroqFunc);
  writeFileSync(path, c, 'utf8');
  console.log('✅ Groq function replaced with Convex action version');
} else {
  console.log('❌ Could not find exact match for old Groq function');
  // Try to find where it starts
  const startIdx = c.indexOf('async function analisarComGroqDireto');
  if (startIdx >= 0) {
    console.log('Found analisarComGroqDireto at position', startIdx);
    console.log('First 200 chars:', c.substring(startIdx, startIdx + 200));
  } else {
    console.log('analisarComGroqDireto not found at all');
  }
}
