import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// ============================================================
// 1. Add cache helper functions BEFORE the main function
// ============================================================

const cacheHelpers = `
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
`;

const marker = '// ═════════════════════════════════════════════════════════════════════\n//  FUNÇÃO PRINCIPAL — Tenta LLM real, fallback para simulação\n// ═════════════════════════════════════════════════════════════════════';
c = c.replace(marker, cacheHelpers + marker);

// ============================================================
// 2. Replace function signature with cache-aware version
// ============================================================

const oldFunc = `export async function analisarComLLM(dados: DadosParaAnalise): Promise<AnaliseLLM> {`;

const newFunc = `/**
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
    return cache.resultado;
  }

  console.log(
    "%c[Risco " + dados.risco_geral + "% vs limiar " + limiar + "%]",
    "color:#93c5fd;font-size:11px"
  );`;

c = c.replace(oldFunc, newFunc);

// ============================================================
// 3. Fix 'async function analisarComGroqDireto' -> add variable function name
// to prevent duplicate issues, and add cache save after Groq result
// ============================================================

// Modify the grokAction call result section to save to cache
const groqSuccessReturn = `      if (result.success && result.data) {
        const validado = validarAnaliseLLM(result.data, "Groq Llama 3 (Convex Action)", dados.fontes_ativas);
        if (validado) return validado;`;

c = c.replace(groqSuccessReturn, `      if (result.success && result.data) {
        const validado = validarAnaliseLLM(result.data, "Groq Llama 3 (Convex Action)", dados.fontes_ativas);
        if (validado) {
          salvarCache(validado, dados.risco_geral);
          return validado;
        }`);

// Modify the fallback return after grokAction - save cache  
const groqManualReturn = `          modelo_utilizado: "Groq Llama 3 (Convex Action)",
          fontes_analisadas: dados.fontes_ativas,
        };
      }`;

c = c.replace(groqManualReturn, `          modelo_utilizado: "Groq Llama 3 (Convex Action)",
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
        );`);

// ============================================================
// 4. Add cache save for the freebuff completion result
// ============================================================

c = c.replace(
  `        if (validado) {
          return validado;
        }`,
  `        if (validado) {
          salvarCache(validado, dados.risco_geral);
          return validado;
        }`
);

// ============================================================
// Write file
// ============================================================
writeFileSync(path, c, 'utf8');
console.log('OK! Cache + limiar adicionados.');

// Verify
const v = readFileSync(path, 'utf8');
console.log('salvarCache:', v.includes('salvarCache'));
console.log('lerCache:', v.includes('lerCache'));
console.log('risco_limiar:', v.includes('risco_limiar'));
console.log('CACHE_KEY:', v.includes('CACHE_KEY'));
