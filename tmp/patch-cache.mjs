import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// ============================================================
// 1. Add cache helper functions BEFORE the export async function
// ============================================================

const cacheHelpers = `
// ═════════════════════════════════════════════════════════════════════
//  CACHE LOCAL — Evita chamadas desnecessárias à Groq
// ═════════════════════════════════════════════════════════════════════

const CACHE_KEY = "sentinela_llm_cache";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 min

interface CacheEntry {
  resultado: AnaliseLLM;
  risco_geral: number;
  timestamp: number;
}

function salvarCache(resultado: AnaliseLLM, risco_geral: number): void {
  try {
    const entry: CacheEntry = { resultado, risco_geral, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    logDebug("Cache salvo com sucesso", { risco_geral, modelo: resultado.modelo_utilizado });
  } catch (e) {
    // localStorage pode falhar (quota excedida, etc.) — ignora
  }
}

function lerCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    // Valida estrutura básica
    if (!entry.resultado || typeof entry.risco_geral !== "number" || typeof entry.timestamp !== "number") {
      return null;
    }
    // Valida campos essenciais do resultado
    if (typeof entry.resultado.resumo_executivo !== "string") {
      return null;
    }
    // Verifica validade (30 min)
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      logDebug("Cache expirado (mais de 30 min)", { idade_ms: Date.now() - entry.timestamp });
      return null;
    }
    logDebug("Cache válido encontrado", {
      risco_geral_cache: entry.risco_geral,
      modelo: entry.resultado.modelo_utilizado,
      idade: Math.round((Date.now() - entry.timestamp) / 60000) + "min",
    });
    return entry;
  } catch {
    return null;
  }
}

/**
 * Verifica se a diferença de risco justifica uma nova chamada LLM.
 * Se o risco atual mudou significativamente (>20 pontos) desde o cache,
 * ou se o cache expirou, retorna true.
 */
function deveReanalisar(riscoAtual: number, cache: CacheEntry | null): boolean {
  if (!cache) return true;
  const diffRisco = Math.abs(riscoAtual - cache.risco_geral);
  // Se risco mudou mais de 20 pontos percentuais, reanalisa
  if (diffRisco > 20) {
    logDebug("Risco mudou significativamente, reanalisando", { diff: Math.round(diffRisco) });
    return true;
  }
  // Se cache expirou (30 min), reanalisa
  if (Date.now() - cache.timestamp > CACHE_DURATION_MS) {
    logDebug("Cache expirou, reanalisando", {});
    return true;
  }
  logDebug("Cache ainda válido, pulando chamada LLM", { diffRisco: Math.round(diffRisco) });
  return false;
}
`;

// Insert cacheHelpers BEFORE the main function comment
const marker = '// ═════════════════════════════════════════════════════════════════════\n//  FUNÇÃO PRINCIPAL — Tenta LLM real, fallback para simulação\n// ═════════════════════════════════════════════════════════════════════';
c = c.replace(marker, cacheHelpers + '\n' + marker);

// ============================================================
// 2. Replace the export async function with cache-aware version
// ============================================================

const oldFunc = `export async function analisarComLLM(dados: DadosParaAnalise): Promise<AnaliseLLM> {`;

const newFunc = `export async function analisarComLLM(
  dados: DadosParaAnalise,
  opcoes?: { risco_limiar?: number; forcar_reanalise?: boolean },
): Promise<AnaliseLLM> {
  const limiar = opcoes?.risco_limiar ?? 50;
  const forcar = opcoes?.forcar_reanalise ?? false;

  // ── Verifica cache local ──
  const cache = lerCache();

  // Se risco < limiar E cache válido → retorna cache sem chamar API
  if (!forcar && dados.risco_geral < limiar && cache) {
    logDebug("🔒 Risco abaixo do limiar (" + limiar + "%), usando cache", {
      risco_geral: dados.risco_geral,
      limiar,
      cache_risco: cache.risco_geral,
    });
    return cache.resultado;
  }

  console.log(`%c⏳ Risco ${dados.risco_geral}% ${dados.risco_geral >= limiar ? "≥" : "<"} limiar ${limiar}% — tentando LLM real...`, "color:#93c5fd;font-size:11px");
`;

c = c.replace(oldFunc, newFunc);

// ============================================================
// 3. After Groq call succeeds && returns valid result -> save to cache
// ============================================================

// After "if (validado) return validado;" in the analisarComFreebuff section,
// we need to add cache saving. But it's complex to track each return point.
// Instead, we'll modify the end of the function before return local.

// Find the local fallback call and add cache logic before it
const localCall = `  // Fallback: análise local
  console.log(
    "%c🔄 Tentativa 3: Análise local (fallback)...",
    "color:#fbbf24;font-size:11px"
  );
  const local = analisarLocal(dados);`;

// Replace to add cache wrapping around Groq/freebuff results
const newLocalCall = `  // Fallback: análise local
  console.log(
    "%c🔄 Tentativa 3: Análise local (fallback)...",
    "color:#fbbf24;font-size:11px"
  );
  const local = analisarLocal(dados);`;

// Actually, the best approach is to intercept the returns from freebuff and groq
// Let me find and modify each return point

// Replace the return after valid freebuff result
c = c.replace(
  '  if (real) {\n    return real;\n  }',
  `  if (real) {
    salvarCache(real, dados.risco_geral);
    return real;
  }`
);

// Replace the return after valid groq result
c = c.replace(
  '  if (groq) {\n    return groq;\n  }',
  `  if (groq) {
    salvarCache(groq, dados.risco_geral);
    return groq;
  }`
);

// ============================================================
// Write the modified file
// ============================================================
writeFileSync(path, c, 'utf8');
console.log('✅ Arquivo modificado com cache + limiar!');

// Verify key parts exist
const verify = readFileSync(path, 'utf8');
console.log('salvarCache:', verify.includes('salvarCache'));
console.log('lerCache:', verify.includes('lerCache'));
console.log('deveReanalisar:', verify.includes('deveReanalisar'));
console.log('risco_limiar:', verify.includes('risco_limiar'));
console.log('CACHE_KEY:', verify.includes('CACHE_KEY'));
console.log('localStorage.getItem(CACHE_KEY):', verify.includes('localStorage.getItem(CACHE_KEY)'));
