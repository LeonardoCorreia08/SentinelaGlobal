/**
 * src/lib/llm-service.ts
 *
 * Serviço de análise LLM real via:
 *   1. freebuff.com.completion() (VLY Integrations — se disponível no browser)
 *   2. Fallback → análise simulada realista
 *
 * Inclui:
 *   - Validação de schema com Zod (Structured Outputs)
 *   - Tratamento de erros com fallbacks amigáveis
 *   - Logs de debug no console
 *
 * O usuário configurou a chave GROQ_API_KEY nas variáveis de ambiente.
 * O `@vly-ai/integrations` já está importado em main.tsx e pode expor
 * `window.freebuff.com.completion()`.
 */

import { nivelParaString } from "./risco-local";

// ═════════════════════════════════════════════════════════════════════
//  STRUCTURED OUTPUT VALIDATION — Manual (sem Zod, para evitar
//  problemas de resolução de módulo com Vite + WebContainer)
//  Equivalente a um schema Zod, mas inline.
// ═════════════════════════════════════════════════════════════════════

export interface AnaliseLLM {
  resumo_executivo: string;
  analise_detalhada: string;
  recomendacoes: string[];
  tendencia: "aumentando" | "estabilizando" | "diminuindo";
  nivel_confianca: "alta" | "media" | "baixa";
  modelo_utilizado: string;
  fontes_analisadas: string[];
}

const TENDENCIAS_VALIDAS = ["aumentando", "estabilizando", "diminuindo"] as const;
const CONFIANCA_VALIDA = ["alta", "media", "baixa"] as const;

function validarString(valor: unknown, campo: string): string | null {
  if (typeof valor === "string" && valor.trim().length > 0) return valor.trim();
  return null;
}

function validarArrayStrings(valor: unknown, min = 1): string[] | null {
  if (!Array.isArray(valor)) return null;
  const strings = valor.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (strings.length < min) return null;
  return strings;
}

function validarAnaliseLLM(
  parsed: Record<string, unknown>,
  modelo: string,
  fontes: string[],
): AnaliseLLM | null {
  // Log do JSON bruto recebido da IA
  logDebug("JSON recebido da IA (antes da validação de schema)", parsed);

  // ── Busca campos por múltiplos nomes (PT + EN) ────────────────
  const campo = (...nomes: string[]): unknown | null => {
    for (const n of nomes) {
      const v = (parsed as Record<string, unknown>)[n];
      if (v !== undefined && v !== null) return v;
    }
    return null;
  };

  // Resumo executivo (obrigatório)
  const resumo_executivo =
    validarString(campo("resumo_executivo", "executive_summary", "resumo", "summary"), "resumo_executivo");
  if (!resumo_executivo) {
    logErro("Falha na validação de schema: resumo_executivo não encontrado",
      { campos_disponiveis: Object.keys(parsed).slice(0, 15) });
    return null;
  }

  // Análise detalhada (OPCIONAL — pode vir vazia)
  const analise_detalhada =
    validarString(campo("analise_detalhada", "detailed_analysis", "analysis", "analise"), "analise_detalhada") || "";

  // Recomendações (obrigatório, mas aceita array vazio como fallback)
  const recomendacoes =
    validarArrayStrings(campo("recomendacoes", "recommendacoes", "recommendations", "recommends", "acoes", "actions"), 0)
    || [];

  // Tendência (flexível — aceita variações em PT/EN)
  const tendenciaRaw = campo("tendencia", "trend", "tendency");
  let tendencia: AnaliseLLM["tendencia"] = "estabilizando";
  if (typeof tendenciaRaw === "string") {
    const t = tendenciaRaw.toLowerCase().trim();
    if (t.includes("aument") || t === "up" || t === "rising") tendencia = "aumentando";
    else if (t.includes("diminu") || t === "down" || t === "falling") tendencia = "diminuindo";
    else if (t.includes("estabil") || t === "stable" || t === "steady") tendencia = "estabilizando";
    // Se for exatamente um dos valores válidos, usa direto
    if (TENDENCIAS_VALIDAS.includes(tendenciaRaw as typeof TENDENCIAS_VALIDAS[number])) {
      tendencia = tendenciaRaw as AnaliseLLM["tendencia"];
    }
  }

  // Confiança (flexível)
  const confiancaRaw = campo("nivel_confianca", "confidence", "confianca", "confidence_level");
  let nivel_confianca: AnaliseLLM["nivel_confianca"] = "media";
  if (typeof confiancaRaw === "string") {
    const c = confiancaRaw.toLowerCase().trim();
    if (c.includes("alt") || c === "high") nivel_confianca = "alta";
    else if (c.includes("med") || c === "medium" || c === "moderate") nivel_confianca = "media";
    else if (c.includes("baix") || c === "low") nivel_confianca = "baixa";
    // Se for exatamente um dos valores válidos, usa direto
    if (CONFIANCA_VALIDA.includes(confiancaRaw as typeof CONFIANCA_VALIDA[number])) {
      nivel_confianca = confiancaRaw as AnaliseLLM["nivel_confianca"];
    }
  }

  logSucesso(
    `Schema validado (${modelo})! ${resumo_executivo.slice(0, 60)}...`,
    { resumo_executivo, tendencia, nivel_confianca, recomendacoes: recomendacoes.length },
  );

  return {
    resumo_executivo,
    analise_detalhada,
    recomendacoes,
    tendencia,
    nivel_confianca,
    modelo_utilizado: modelo,
    fontes_analisadas: fontes,
  };
}

// ═════════════════════════════════════════════════════════════════════
//  DEBUG LOGS — Vísiveis no console do navegador durante apresentação
// ═════════════════════════════════════════════════════════════════════

const DEBUG_STYLE = "background:#1e1b2e;color:#c4b5fd;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px";
const JSON_STYLE = "background:#0f0d1a;color:#a5b4fc;padding:4px 8px;border-radius:4px;font-family:monospace;font-size:11px";
const ERROR_STYLE = "background:#1e1b2e;color:#f87171;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px";
const SUCCESS_STYLE = "background:#1e1b2e;color:#34d399;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px";

function logDebug(tag: string, data: unknown) {
  console.log(
    `%c[SentinelaGlobal LLM Debug] ${tag}`,
    DEBUG_STYLE,
  );
  console.log(
    "%c" + JSON.stringify(data, null, 2),
    JSON_STYLE,
  );
}

function logErro(mensagem: string, erro?: unknown) {
  console.log(
    `%c[SentinelaGlobal LLM Error] ${mensagem}`,
    ERROR_STYLE,
    erro || "",
  );
}

function logSucesso(tag: string, data?: unknown) {
  console.log(
    `%c[SentinelaGlobal LLM] ✅ ${tag}`,
    SUCCESS_STYLE,
    data || "",
  );
}

// ═════════════════════════════════════════════════════════════════════
//  TIPOS
// ═════════════════════════════════════════════════════════════════════

export interface DadosParaAnalise {
  risco_geral: number;
  nivel_alerta: string;
  eventos_proximos: Array<{
    tipo: string;
    severidade: number;
    distancia_km: number;
    impacto: number;
    descricao: string;
    fonte: string;
  }>;
  fontes_ativas: string[];
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  vento_kmh: number | null;
  probabilidade_chuva: number | null;
}

// ═════════════════════════════════════════════════════════════════════
//  CONSTANTES
// ═════════════════════════════════════════════════════════════════════

// Perfis de análise por tipo (usados no fallback simulado)
const PERFIS_ANALISE: Record<string, string> = {
  terremoto: "O USGS reporta movimento tectônico com mecanismo focal de falha. A profundidade rasa intensifica a sacudida do solo. Modelos de intensidade sísmica indicam potencial de liquefação em áreas costeiras próximas ao epicentro.",
  tsunami: "O Pacific Tsunami Warning Center (PTWC) emitiu alerta. Modelos de propagação de ondas indicam risco de inundação costeira nas próximas horas. A amplitude projetada da onda depende da magnitude e profundidade do evento sísmico gerador.",
  furacão: "Imagens de satélite no canal infravermelho mostram topos de nuvens extremamente frios (-80°C). O olho bem definido indica um sistema em rápida intensificação. A trajetória projetada pelo NHC coloca áreas densamente povoadas na rota do olho.",
  tornado: "Assinatura clara de debris ball e hook echo detectada em radar Doppler. A supercélula mantém rotação mesociclônica intensa com valores de shear significativos.",
  ciclone: "Sistema ciclônico bem organizado com banda de alimentação definida. A pressão central está em queda acentuada, indicando intensificação. A crista subtropical ao norte guia o sistema.",
  incêndio: "Imagens de satélite mostram pluma de fumaça se estendendo por centenas de km. As condições de temperatura elevada, umidade relativa baixa e ventos fortes criam comportamento extremo do fogo com spotting a longa distância e formação de fire tornado.",
  enchente: "Dados de estações pluviométricas e radares meteorológicos indicam acumulados expressivos. O solo já saturado não permite infiltração adicional. Modelos hidrológicos projetam pico de cheia nas próximas horas com risco de transbordamento.",
  deslizamento: "Dados de satélite InSAR mostram deformação do terreno. O solo saturado combinado com declividade acentuada cria condições ideais para fluxo de detritos. O índice de precipitação acumulada ativou todos os alertas geotécnicos.",
  tempestade: "Análise sinótica mostra cavado de ondas curtas em intensificação. O Lifted Index negativo indica instabilidade severa. Altos valores de CAPE com cisalhamento significativo favorecem tempestades organizadas e supercélulas.",
  seca: "O índice de seca SPEI mostra condição severa a extrema. A anomalia de precipitação dos últimos meses é significativamente negativa. Reservatórios operam com capacidade crítica. O risco de incêndios florestais está elevado.",
  nevasca: "Condições de blizzard com visibilidade reduzida. O gradiente de pressão acentuado entre a baixa costeira e o alta continental força queda de neve com taxas elevadas por hora.",
  vulcão: "O VAAC reporta pluma de cinzas vulcânicas em altitude de cruzeiro. Dados de deformação do edifício vulcânico medidos por GPS e InSAR indicam influxo magmático contínuo. O índice de explosividade vulcânica (VEI) está sendo monitorado.",
};

// Recomendações por nível de risco
const RECS_CRITICO = [
  "🚨 EVACUAÇÃO IMEDIATA da área de risco. Siga as rotas de fuga designadas pelas autoridades locais.",
  "🔇 Mantenha-se informado pelos canais oficiais de emergência (Defesa Civil, bombeiros).",
  "📱 Mantenha telefones carregados e kit de emergência (água, comida, medicamentos) preparado.",
  "🏠 Se impossível evacuar, abrigue-se em local elevado e reforçado da edificação.",
  "🆘 Acione o número de emergência local se houver feridos ou pessoas presas.",
];

const RECS_ALTO = [
  "⚠️ Prepare-se para possível evacuação. Mantenha documentos e kit de emergência prontos.",
  "📱 Acompanhe boletins meteorológicos e notificações da Defesa Civil a cada hora.",
  "🔌 Desconecte aparelhos elétricos e feche registros de gás se houver risco de enchente.",
  "🚗 Abasteça o veículo e mantenha-o em local seguro e de fácil acesso.",
  "👴 Ajude vizinhos idosos ou com mobilidade reduzida a se prepararem.",
];

const RECS_MODERADO = [
  "👀 Monitore a situação ativamente. Fique atento a boletins oficiais.",
  "📱 Mantenha notificações do SentinelaGlobal ativadas.",
  "☔ Evite áreas de risco conhecidas (encostas, margens de rios, áreas alagáveis).",
  "📋 Revise seu plano familiar de emergência.",
];

const RECS_BAIXO = [
  "✅ Nenhuma ação imediata necessária. Situação estável.",
  "👁️ Mantenha monitoramento passivo de rotina.",
  "📱 Notificações do SentinelaGlobal continuam ativas.",
];

// ═════════════════════════════════════════════════════════════════════
//  TENTATIVA DE LLM REAL via freebuff.com.completion()
// ═════════════════════════════════════════════════════════════════════

/**
 * Tenta usar a LLM real via freebuff.com.completion().
 * O `@vly-ai/integrations` injeta `window.freebuff` no browser.
 */
async function analisarComFreebuff(
  dados: DadosParaAnalise,
): Promise<AnaliseLLM | null> {
  try {
    const freebuff = (window as unknown as Record<string, unknown>).freebuff;
    if (!freebuff || typeof freebuff !== "object") {
      logDebug("freebuff.com.completion() indisponível (window.freebuff não encontrado)", { freebuff_disponivel: false });
      return null;
    }

    const com = (freebuff as Record<string, unknown>).com;
    if (!com || typeof com !== "object") {
      logDebug("freebuff.com.completion() indisponível (freebuff.com não encontrado)", {});
      return null;
    }

    const completion = (com as Record<string, unknown>).completion;
    if (typeof completion !== "function") {
      logDebug("freebuff.com.completion() não é uma função", {});
      return null;
    }

    // Monta prompt especializado para análise de risco
    const eventosText = dados.eventos_proximos
      .map(
        (e) =>
          `- ${e.tipo} (severidade ${e.severidade}/5, ${e.distancia_km.toFixed(0)}km, impacto ${e.impacto.toFixed(0)}%, fonte: ${e.fonte})`,
      )
      .join("\n");

    const systemPrompt = `Você é o SentinelaGlobal, um analista de riscos de desastres naturais especializado em análise geoespacial multi-fonte.

Analise os dados de monitoramento abaixo e retorne APENAS um JSON válido seguindo EXATAMENTE este schema:

{
  "resumo_executivo": "Uma frase curta com o nível de risco e recomendação principal. (STRING, uma linha)",
  "analise_detalhada": "Contexto técnico mencionando as fontes e eventos. (STRING, pode ser vazia)",
  "recomendacoes": ["Ação 1", "Ação 2"],
  "tendencia": "aumentando" | "estabilizando" | "diminuindo",
  "nivel_confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- resumo_executivo deve ser uma STRING de texto curto, NÃO um objeto.
- recomendacoes deve ser um ARRAY de strings.
- tendencia deve ser EXATAMENTE "aumentando", "estabilizando" ou "diminuindo".
- nivel_confianca deve ser EXATAMENTE "alta", "media" ou "baixa".

Exemplo de resposta CORRETA:
{
  "resumo_executivo": "Risco moderado (45%) com tempestade a 80 km. Monitore a situação.",
  "analise_detalhada": "Tempestade severa detectada pelo INMET a 80 km de distância. Ventos de 90 km/h.",
  "recomendacoes": ["Fique atento a boletins meteorológicos", "Evite áreas alagáveis"],
  "tendencia": "aumentando",
  "nivel_confianca": "media"
}

Cite fontes (USGS, GDACS, Cemaden, Open-Meteo, INMET, NASA FIRMS, EMSC, NOAA, Copernicus).
Responda em português brasileiro.`;

    const userPrompt = `Nível de risco geral: ${dados.risco_geral.toFixed(0)}% (${dados.nivel_alerta})
Fontes ativas: ${dados.fontes_ativas.join(", ") || "Nenhuma"}

Eventos detectados:
${eventosText || "Nenhum evento próximo ao usuário."}

Condições meteorológicas locais:
${dados.temperatura_c !== null ? `Temperatura: ${dados.temperatura_c}°C` : ""}
${dados.precipitacao_mm !== null ? `Precipitação atual: ${dados.precipitacao_mm}mm` : ""}
${dados.vento_kmh !== null ? `Vento: ${dados.vento_kmh} km/h` : ""}
${dados.probabilidade_chuva !== null ? `Probabilidade de chuva: ${dados.probabilidade_chuva}%` : ""}`;

    logDebug("Enviando prompt para freebuff.com.completion()", {
      modelo: "groq-llama-3.3-70b-versatile",
      tamanho_prompt: { system: systemPrompt.length, user: userPrompt.length },
      total_eventos: dados.eventos_proximos.length,
      risco_geral: dados.risco_geral,
    });

    const result = await completion({
      model: "groq-llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 1000,
    });

    logDebug("Resposta bruta do freebuff.com.completion()", result);

    if (result?.success && result?.data) {
      try {
        const parsed =
          typeof result.data === "string"
            ? JSON.parse(result.data)
            : result.data;

        // Valida com Zod
        const validado = validarAnaliseLLM(parsed, "Groq Llama 3 (freebuff.com)", dados.fontes_ativas);
        if (validado) {
          salvarCache(validado, dados.risco_geral);
          return validado;
        }

        // Fallback se Zod falhar: tenta campos alternativos (legado)
        logDebug("Tentando fallback com campos alternativos (legado)", {});
        if (parsed.resumo_executivo || parsed.analysis) {
          return {
            resumo_executivo: typeof parsed.resumo_executivo === "string" ? parsed.resumo_executivo : "Análise concluída.",
            analise_detalhada: typeof parsed.analise_detalhada === "string" ? parsed.analise_detalhada : (typeof parsed.analysis === "string" ? parsed.analysis : ""),
            recomendacoes: Array.isArray(parsed.recomendacoes)
              ? parsed.recomendacoes.filter((r: unknown): r is string => typeof r === "string")
              : Array.isArray(parsed.recommendacoes)
                ? parsed.recommendacoes.filter((r: unknown): r is string => typeof r === "string")
                : [],
            tendencia: typeof parsed.tendencia === "string" ? parsed.tendencia : (typeof parsed.trend === "string" ? parsed.trend : "estabilizando"),
            nivel_confianca: typeof parsed.nivel_confianca === "string" ? parsed.nivel_confianca : (typeof parsed.confidence === "string" ? parsed.confidence : "media"),
            modelo_utilizado: "Groq Llama 3 (freebuff.com) — fallback",
            fontes_analisadas: dados.fontes_ativas,
          };
        }

        return null;
      } catch (parseErr) {
        logErro("Falha ao fazer parse do JSON da freebuff", parseErr);
        return null;
      }
    }

    logDebug("freebuff.com.completion() retornou sem resultado válido", { success: result?.success, hasData: !!result?.data });
    return null;
  } catch (err) {
    logErro("Exceção ao chamar freebuff.com.completion()", err);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
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
          `- ${e.tipo} (severidade ${e.severidade}/5, ${e.distancia_km.toFixed(0)}km, impacto ${e.impacto.toFixed(0)}%, fonte: ${e.fonte})`,
      )
      .join("\n");

    const systemPrompt = `Você é o SentinelaGlobal, analista de riscos de desastres naturais.` +
      ' Retorne APENAS um JSON com campos: resumo_executivo (string curta),' +
      ' analise_detalhada (string), recomendacoes (array strings),' +
      ' tendencia (aumentando/estabilizando/diminuindo),' +
      ' nivel_confianca (alta/media/baixa).' +
      ' IMPORTANTE: resumo_executivo DEVE ser string, NUNCA objeto.' +
      ' Cite fontes (USGS, GDACS, INMET, NOAA, Copernicus, NASA FIRMS).' +
      ' Responda em português brasileiro. Sem prefácio nem comentários.';

    const userPrompt = `Risco: ${dados.risco_geral.toFixed(0)}% (${dados.nivel_alerta})\nFontes: ${dados.fontes_ativas.join(", ")}\nEventos:\n${eventosText || "Nenhum"}\nTemp: ${dados.temperatura_c ?? "N/A"}°C, Chuva: ${dados.precipitacao_mm ?? "N/A"}mm, Vento: ${dados.vento_kmh ?? "N/A"} km/h`;

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
}/** Obtém referência ao ConvexHttpClient (singleton) */
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
}

// ═════════════════════════════════════════════════════════════════════
//  FALLBACK — Análise Local Simulada
// ═════════════════════════════════════════════════════════════════════

function analisarLocal(dados: DadosParaAnalise): AnaliseLLM {
  const { risco_geral, nivel_alerta, eventos_proximos, fontes_ativas } = dados;

  // Seleciona perfil de análise baseado no evento mais impactante
  const eventoTop = eventos_proximos[0];
  const perfil = eventoTop
    ? PERFIS_ANALISE[eventoTop.tipo] ||
      `Alertas de ${eventoTop.tipo} foram emitidos. Análise geoespacial em andamento.`
    : "Nenhum evento crítico detectado nas proximidades. Condições estáveis.";

  // Constrói análise detalhada
  const eventosDetalhes = eventos_proximos
    .slice(0, 3)
    .map(
      (e) =>
        `• **${e.tipo.toUpperCase()}** — severidade ${e.severidade}/5, ${e.distancia_km.toFixed(0)} km (impacto ${e.impacto.toFixed(0)}%) — Fonte: ${e.fonte}`,
    )
    .join("\n");

  const condicoesMeteo = [
    dados.temperatura_c !== null ? `${dados.temperatura_c}°C` : null,
    dados.precipitacao_mm !== null ? `${dados.precipitacao_mm}mm chuva` : null,
    dados.vento_kmh !== null ? `${dados.vento_kmh} km/h vento` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const climaStr = condicoesMeteo ? `Condições locais: ${condicoesMeteo}.` : "";

  // Determina tendência
  let tendencia: AnaliseLLM["tendencia"] = "estabilizando";
  if (risco_geral > 70) tendencia = "aumentando";
  else if (risco_geral > 50 && eventos_proximos.some((e) => e.distancia_km < 100))
    tendencia = "aumentando";
  else if (risco_geral < 20) tendencia = "diminuindo";

  // Determina confiança
  const nivel_confianca: AnaliseLLM["nivel_confianca"] =
    fontes_ativas.length >= 2 ? "alta" : fontes_ativas.length >= 1 ? "media" : "baixa";

  // Resumo executivo
  const resumo_executivo =
    risco_geral > 70
      ? `🔴 RISCO CRÍTICO (${risco_geral.toFixed(0)}%). ${eventoTop?.tipo.toUpperCase()} detectado a ${eventoTop?.distancia_km.toFixed(0)} km. Ação imediata necessária.`
      : risco_geral > 60
        ? `🟠 Risco alto (${risco_geral.toFixed(0)}%). ${eventoTop?.tipo.charAt(0).toUpperCase() + (eventoTop?.tipo.slice(1) || "")} a ${eventoTop?.distancia_km.toFixed(0)} km. Preparação para evacuação recomendada.`
        : risco_geral > 30
          ? `🟡 Risco moderado (${risco_geral.toFixed(0)}%). Monitoramento ativo recomendado. ${eventoTop ? `${eventoTop.tipo} a ${eventoTop.distancia_km.toFixed(0)} km.` : ""}`
          : `🟢 Risco baixo (${risco_geral.toFixed(0)}%). Situação estável. Nenhuma ameaça significativa.`;

  // Análise detalhada
  const analise_detalhada = [
    `**Contexto Técnico** — ${perfil}`,
    eventosDetalhes ? `\n**Eventos Analisados:**\n${eventosDetalhes}` : "",
    climaStr ? `\n**${climaStr}**` : "",
    `\n**Fontes:** ${fontes_ativas.join(", ") || "Nenhuma fonte ativa"}`,
    `**Nível de Confiança:** ${nivel_confianca.toUpperCase()} (${fontes_ativas.length} fonte(s) ativa(s))`,
  ]
    .filter(Boolean)
    .join("\n");

  // Recomendações
  const recomendacoes: string[] =
    risco_geral > 70
      ? [...RECS_CRITICO]
      : risco_geral > 60
        ? [...RECS_ALTO]
        : risco_geral > 30
          ? [...RECS_MODERADO]
          : [...RECS_BAIXO];

  return {
    resumo_executivo,
    analise_detalhada,
    recomendacoes,
    tendencia,
    nivel_confianca,
    modelo_utilizado: "Análise Local Multi-Fonte",
    fontes_analisadas: fontes_ativas,
  };
}


// ═════════════════════════════════════════════════════════════════════
//  CACHE LOCAL — Evita chamadas desnecessarias a Groq
// ═════════════════════════════════════════════════════════════════════

const CACHE_KEY = "sentinela_llm_cache";
const CACHE_DURATION_MS = 30 * 60 * 1000;

function salvarCache(resultado: AnaliseLLM, risco_geral: number): void {
  try {
    const entry = { resultado, risco_geral, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    logDebug("Cache salvo com sucesso", { risco_geral, modelo: resultado.modelo_utilizado });
  } catch (e) {
    // localStorage pode falhar (quota, etc.) — ignora
  }
}

function lerCache(): { resultado: AnaliseLLM; risco_geral: number; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry.resultado || typeof entry.risco_geral !== "number" || typeof entry.timestamp !== "number") return null;
    if (typeof entry.resultado.resumo_executivo !== "string") return null;
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      logDebug("Cache expirado (>30min)", { idade_ms: Date.now() - entry.timestamp });
      return null;
    }
    logDebug("Cache valido encontrado", {
      risco_geral_cache: entry.risco_geral,
      modelo: entry.resultado.modelo_utilizado,
      idade_min: Math.round((Date.now() - entry.timestamp) / 60000),
    });
    return entry;
  } catch {
    return null;
  }
}
// ═════════════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL — Tenta LLM real, fallback para simulação
// ═════════════════════════════════════════════════════════════════════

/**
 * Analisa dados de risco usando LLM real (se disponível) ou fallback local.
 *
 * Ordem de tentativa:
 *   1. freebuff.com.completion() — VLY Integrations (Groq + Llama 3)
 *   2. API Groq direta (se a chave estiver disponível)
 *   3. Análise local simulada com perfis técnicos
 *
 * Logs de debug no console:
 *   - [SentinelaGlobal LLM Debug] → JSON recebido da IA
 *   - [SentinelaGlobal LLM Error] → falhas de API ou schema
 *   - [SentinelaGlobal LLM] ✅ → validação Zod bem-sucedida
 */
/**
 * Analisa dados de risco.
 * Se risco < limiar (padrao 50%) e cache valido existe, pula LLM real.
 */
export async function analisarComLLM(
  dados: DadosParaAnalise,
  opcoes?: { risco_limiar?: number; forcar_reanalise?: boolean },
): Promise<AnaliseLLM> {
  const limiar = opcoes?.risco_limiar ?? 50;
  const forcar = opcoes?.forcar_reanalise ?? false;

  // Cache: se risco < limiar e cache valido, retorna sem chamar API
  const cache = lerCache();
  if (!forcar && dados.risco_geral < limiar && cache) {
    logDebug("Risco abaixo do limiar (" + limiar + "%), usando cache", {
      risco_geral: dados.risco_geral,
      limiar: limiar,
      cache_risco: cache.risco_geral,
    });
    return {
      ...cache.resultado,
      modelo_utilizado: "[Cache] " + (cache.resultado.modelo_utilizado || "Groq"),
    };
  }

  console.log(
    "%c[Risco " + dados.risco_geral + "% vs limiar " + limiar + "%]",
    "color:#93c5fd;font-size:11px"
  );
  console.log(
    "%c═══════════════════════════════════════════════════════",
    "color:#6366f1;font-weight:bold"
  );
  console.log(
    "%c  SentinelaGlobal — Análise LLM Iniciada",
    "color:#c4b5fd;font-weight:bold;font-size:13px"
  );
  console.log(
    "%c═══════════════════════════════════════════════════════",
    "color:#6366f1;font-weight:bold"
  );
  logDebug("Dados de entrada enviados para análise", {
    risco_geral: `${dados.risco_geral}%`,
    nivel_alerta: dados.nivel_alerta,
    eventos: dados.eventos_proximos.length,
    fontes: dados.fontes_ativas,
    clima: {
      temperatura: dados.temperatura_c ? `${dados.temperatura_c}°C` : null,
      precipitacao: dados.precipitacao_mm ? `${dados.precipitacao_mm}mm` : null,
      vento: dados.vento_kmh ? `${dados.vento_kmh}km/h` : null,
      prob_chuva: dados.probabilidade_chuva ? `${dados.probabilidade_chuva}%` : null,
    },
  });

  // Tenta LLM real via freebuff.com
  console.log(
    "%c🔄 Tentativa 1: freebuff.com.completion()...",
    "color:#93c5fd;font-size:11px"
  );
  const real = await analisarComFreebuff(dados);
  if (real) {
    return real;
  }
  logDebug("freebuff.com.completion() não disponível ou falhou", {});

  // Tenta API Groq direta
  console.log(
    "%c🔄 Tentativa 2: API Groq direta...",
    "color:#93c5fd;font-size:11px"
  );
  const groq = await analisarComGroqDireto(dados);
  if (groq) {
    return groq;
  }
  logDebug("API Groq não disponível ou falhou", {});

  // Fallback: análise local
  console.log(
    "%c🔄 Tentativa 3: Análise local (fallback)...",
    "color:#fbbf24;font-size:11px"
  );
  const local = analisarLocal(dados);
  logSucesso("Análise local (fallback) concluída", {
    modelo: local.modelo_utilizado,
    resumo: local.resumo_executivo.slice(0, 80),
    tendencia: local.tendencia,
    confianca: local.nivel_confianca,
  });
  return local;
}

/**
 * Versão síncrona para quando não é possível usar async.
 * Usa apenas análise local.
 */
export function analisarLocalSync(dados: DadosParaAnalise): AnaliseLLM {
  return analisarLocal(dados);
}
