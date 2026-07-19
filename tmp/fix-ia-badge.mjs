import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Current IA badge text - match to fontes badge style
const oldBadge = `<span className={\`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5 \${
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

// New IA badge - exact same style as fontes badges
const newBadge = `<span className={\`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1 \${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                      }\`}>
                        <span className={\`w-1.5 h-1.5 rounded-full animate-pulse \${
                          modeloLLM.includes("[Cache]")
                            ? "bg-yellow-400"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                              ? "bg-emerald-400"
                              : "bg-sky-400"
                        }\`} />
                        {modeloLLM.includes("[Cache]") ? "Cache Groq"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "IA Real"
                          : "Fallback local"}
                      </span>`;

if (c.includes(oldBadge)) {
  c = c.replace(oldBadge, newBadge);
  console.log("IA badge updated to match fontes style!");
} else {
  console.log("Old badge pattern not found!");
  const idx = c.indexOf('IA:');
  if (idx >= 0) {
    console.log("Found IA: at", idx);
    console.log("Context:", c.substring(idx, idx + 600));
  }
}

writeFileSync(path, c, 'utf8');
console.log("Done!");
