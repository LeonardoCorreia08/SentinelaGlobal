import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Direct emoji characters
const greenDot = '\u{1F7E2}'; // 🟢
const yellowDot = '\u{1F7E1}'; // 🟡
const blueDot = '\u{1F535}'; // 🔵

// Replace the text labels in the IA badge
// The current code has: " Groq", " IA Real", " Fallback local"
// We want: "🟡 Groq", "🟢 IA Real", "🔵 Fallback local"

// Replace in the badge text
c = c.replace(
  'modeloLLM.includes("[Cache]") ? " Groq"',
  `modeloLLM.includes("[Cache]") ? "${yellowDot} Groq"`
);
c = c.replace(
  'modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? " IA Real"',
  `modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "${greenDot} IA Real"`
);
c = c.replace(
  ': " Fallback local"',
  `: "${blueDot} Fallback local"`
);

// Also update the header dot - show emoji directly
// Find the header dot span and add emoji alongside it
// First, check if header has the dot span
const headerCheck = c.includes('w-2 h-2 rounded-full inline-block');
if (headerCheck) {
  // The header already has a CSS dot, but let's also add the emoji in the modeloLLM text
  // Replace "{modeloLLM}" in header with emoji + modeloLLM
  // Find the specific instance in the header
  const headerIdx = c.indexOf('text-muted-foreground bg-muted/50 px-1.5');
  if (headerIdx >= 0) {
    const modelSpan = c.indexOf('{modeloLLM}', headerIdx);
    if (modelSpan >= 0) {
      // The header already has the CSS dot span before modeloLLM, that should be enough
      console.log("Header dot span already exists");
    }
  }
}

writeFileSync(path, c, 'utf8');
console.log(`Emoji added! ${greenDot} ${yellowDot} ${blueDot}`);

// Verify
const verify = readFileSync(path, 'utf8');
console.log('Contains 🟢:', verify.includes(greenDot));
console.log('Contains 🟡:', verify.includes(yellowDot));
console.log('Contains 🔵:', verify.includes(blueDot));
