import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Replace the text labels to include emoji characters
// Current: ? "Groq" : ? "IA Real" : "Fallback local"
// New: ? "🟡 Groq" : ? "🟢 IA Real" : "🔵 Fallback local"

const oldText = `{modeloLLM.includes("[Cache]") ? " Groq"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? " IA Real"
                            : " Fallback local"}`;

const newText = `{modeloLLM.includes("[Cache]") ? "\\ud83d\\udfe1 Groq"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "\\ud83d\\udfe2 IA Real"
                            : "\\ud83d\\udd35 Fallback local"}`;

if (c.includes(oldText)) {
  c = c.replace(oldText, newText);
  console.log("Emoji added to IA badge text!");
} else {
  console.log("Pattern not found!");
  const idx = c.indexOf('"IA Real"');
  if (idx >= 0) {
    console.log("Found IA Real at", idx);
    console.log("Context:", c.substring(idx - 50, idx + 80));
  }
  const idx2 = c.indexOf('"Groq"');
  if (idx2 >= 0) {
    console.log("Found Groq at", idx2);
    console.log("Context:", c.substring(idx2 - 50, idx2 + 20));
  }
}

writeFileSync(path, c, 'utf8');
console.log("Done!");
