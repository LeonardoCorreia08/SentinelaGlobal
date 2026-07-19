import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// ============================================================
// 1. Replace the header modelLLM display (add colored dot before model name)
// ============================================================
// Old: <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full flex items-center gap-1">{modeloLLM}
// New: Add a colored dot before the model name

const oldHeader = `  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
    {modeloLLM}
    <span`;

const newHeader = `  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
    <span className={\`w-2 h-2 rounded-full inline-block \${
      modeloLLM.includes("[Cache]")
        ? "bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]"
        : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
          : "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
    }\`} />
    {modeloLLM}
    <span`;

if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  console.log("1. Header dot added!");
} else {
  console.log("1. Header pattern not found!");
}

// ============================================================
// 2. Replace the "Tipo:" badge (IA real / Fallback local)
// ============================================================
// Replace the badge that shows "IA real" or "Fallback local" with colored dots

const oldBadge = `<span className="text-[10px] text-muted-foreground">Tipo:</span>
  <span className={\`text-[10px] font-medium px-1.5 py-0.5 rounded-full border \${
    modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
  }\`}>
    {modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "🤖 IA real" : "📊 Fallback local"}
  </span>`;

const newBadge = `<span className="text-[10px] text-muted-foreground">IA:</span>
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

if (c.includes(oldBadge)) {
  c = c.replace(oldBadge, newBadge);
  console.log("2. Badge replaced with colored dots!");
} else {
  console.log("2. Badge pattern not found!");
  // Try to find the badge with different whitespace
  const badgeIdx = c.indexOf('Tipo:');
  if (badgeIdx >= 0) {
    console.log("Found 'Tipo:' at", badgeIdx);
    console.log(c.substring(badgeIdx, badgeIdx + 400));
  }
}

// ============================================================
// 3. Write file
// ============================================================
writeFileSync(path, c, 'utf8');
console.log("Done!");
