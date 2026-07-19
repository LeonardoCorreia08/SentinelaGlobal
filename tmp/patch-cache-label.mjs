import { readFileSync, writeFileSync } from 'fs';
const path = 'src/lib/llm-service.ts';
let c = readFileSync(path, 'utf8');

// When returning cache, add [Cache] prefix to modelo_utilizado
// Find the cache return in analisarComLLM
const oldCacheReturn = `    logDebug("Risco abaixo do limiar (" + limiar + "%), usando cache", {
      risco_geral: dados.risco_geral,
      limiar: limiar,
      cache_risco: cache.risco_geral,
    });
    return cache.resultado;`;

const newCacheReturn = `    logDebug("Risco abaixo do limiar (" + limiar + "%), usando cache", {
      risco_geral: dados.risco_geral,
      limiar: limiar,
      cache_risco: cache.risco_geral,
    });
    return {
      ...cache.resultado,
      modelo_utilizado: "[Cache] " + (cache.resultado.modelo_utilizado || "Groq"),
    };`;

if (c.includes(oldCacheReturn)) {
  c = c.replace(oldCacheReturn, newCacheReturn);
  console.log("Cache prefix added!");
} else {
  console.log("Cache return pattern not found - checking...");
  const idx = c.indexOf('usando cache');
  if (idx >= 0) {
    console.log("Found 'usando cache' at", idx);
    console.log(c.substring(idx, idx + 300));
  } else {
    console.log("Pattern 'usando cache' not found either");
    const idx2 = c.indexOf('cache.risco_geral');
    if (idx2 >= 0) console.log("Found cache.risco_geral at", idx2, "context:", c.substring(idx2 - 100, idx2 + 100));
  }
}

writeFileSync(path, c, 'utf8');
console.log("Done!");
