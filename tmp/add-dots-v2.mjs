import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// ============================================================
// 1. Header dot: Add a colored dot before {modeloLLM} on its own line
// Replace: "                      {modeloLLM}" with dot + {modeloLLM}
// ============================================================

const oldModelLine = '                      {modeloLLM}';
const newModelLine = `                      <span className={\`w-2 h-2 rounded-full inline-block mr-1.5 \${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                            : "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                      }\`} />
                      {modeloLLM}`;

if (c.includes(oldModelLine)) {
  c = c.replace(oldModelLine, newModelLine);
  console.log("1. Header dot added!");
} else {
  console.log("1. FAILED - oldModelLine not found");
  // Find where modeloLLM appears alone in JSX
  const idx = c.indexOf('{modeloLLM}');
  if (idx >= 0) {
    console.log("Found {modeloLLM} at index", idx);
    console.log("Context:", JSON.stringify(c.substring(idx - 50, idx + 50)));
  }
}

// ============================================================
// 2. Badge: Replace the "Tipo:" section with colored dot indicator
// ============================================================

const oldBadgeText = `                      <span className="text-[10px] text-muted-foreground">Tipo:</span>
                      <span className={\`text-[10px] font-medium px-1.5 py-0.5 rounded-full border \${
                        modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }\`}>
                        {modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "🤖 IA real" : "📊 Fallback local"}
                      </span>`;

const newBadgeText = `                      <span className="text-[10px] text-muted-foreground">IA:</span>
                      <span className={\`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 \${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                      }\`}>
                        <span className={\`w-2 h-2 rounded-full \${
                          modeloLLM.includes("[Cache]")
                            ? "bg-yellow-400 animate-pulse"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                              ? "bg-emerald-400"
                              : "bg-sky-400"
                        }\`} />
                        {modeloLLM.includes("[Cache]") ? "Cache Groq"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "IA Real"
                          : "Fallback local"}
                      </span>`;

if (c.includes(oldBadgeText)) {
  c = c.replace(oldBadgeText, newBadgeText);
  console.log("2. Badge replaced!");
} else {
  console.log("2. FAILED - oldBadgeText not found");
  // Debug: find the "Tipo:" text
  const tipoIdx = c.indexOf('Tipo:');
  if (tipoIdx >= 0) {
    console.log("Found 'Tipo:' at index", tipoIdx);
    console.log("Context:", JSON.stringify(c.substring(tipoIdx - 20, tipoIdx + 350)));
  }
}

// Write
writeFileSync(path, c, 'utf8');
console.log("Done!");
