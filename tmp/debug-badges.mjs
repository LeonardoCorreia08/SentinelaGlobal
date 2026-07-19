import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');

// Check if the colored dots exist
console.log("=== Header dot check ===");
const headerDot = c.includes('bg-emerald-400 shadow-[');
const headerDotYellow = c.includes('bg-yellow-400 shadow-[');
console.log("Header green dot:", headerDot);
console.log("Header yellow dot:", headerDotYellow);

console.log("\n=== IA badge check ===");
const iaBadgeDot = c.includes('IA:');
const iaDotGreen = c.includes('"IA Real"');
const iaDotYellow = c.includes('"Groq"');
const iaDotBlue = c.includes('"Fallback local"');
console.log("IA label found:", iaBadgeDot);
console.log("IA Real found:", iaDotGreen);
console.log("Groq (cache) found:", iaDotYellow);
console.log("Fallback local found:", iaDotBlue);

// Find exact IA badge section
const iaIdx = c.indexOf('IA:');
if (iaIdx >= 0) {
  const endIdx = c.indexOf('</div>', iaIdx + 250);
  console.log("\n=== FULL IA BADGE CODE ===");
  console.log(c.substring(Math.max(0, iaIdx - 80), endIdx + 20));
} else {
  console.log("\n=== Searching for badge patterns ===");
  // Look for the old pattern
  const tipoIdx = c.indexOf('Tipo:');
  if (tipoIdx >= 0) console.log("Old 'Tipo:' still present");
  
  // Look for modeloLLM references
  const lineIdx = c.indexOf('modeloLLM');
  if (lineIdx >= 0) {
    console.log("modeloLLM found at", lineIdx);
    console.log("Context:", c.substring(lineIdx - 100, lineIdx + 300));
  }
}

// Check llm-service for cache prefix
console.log("\n=== Cache prefix check (llm-service.ts) ===");
try {
  const llm = readFileSync('src/lib/llm-service.ts', 'utf8');
  console.log("[Cache] prefix:", llm.includes('[Cache]'));
  console.log("salvarCache:", llm.includes('salvarCache'));
  console.log("lerCache:", llm.includes('lerCache'));
} catch(e) { console.log("Error reading llm-service.ts:", e.message); }
