import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Replace "Cache Groq" with just "Groq" in the IA badge
const oldText = `modeloLLM.includes("[Cache]") ? "Cache Groq"`;
const newText = `modeloLLM.includes("[Cache]") ? "Groq"`;

if (c.includes(oldText)) {
  c = c.replace(oldText, newText);
  console.log("Text 'Cache Groq' changed to 'Groq'!");
} else {
  console.log("Pattern not found!");
  // Find the pattern
  const idx = c.indexOf('Cache Groq');
  if (idx >= 0) {
    console.log("Found 'Cache Groq' at index", idx);
    console.log("Context:", c.substring(idx - 20, idx + 20));
  }
}

writeFileSync(path, c, 'utf8');
console.log("Done!");
