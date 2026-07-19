import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// 1. Find the IA badge section and verify it exists
const iaIdx = c.indexOf('IA:');
if (iaIdx < 0) {
  console.log('ERROR: IA: label not found in file');
  process.exit(1);
}

const endIdx = c.indexOf('</div>', iaIdx + 300);
const iaSection = c.substring(Math.max(0, iaIdx - 100), endIdx + 20);
console.log('=== CURRENT IA SECTION ===');
console.log(iaSection);

// 2. Check if the colored span dot exists in the section
const hasGreen = iaSection.includes('bg-emerald-400');
const hasYellow = iaSection.includes('bg-yellow-400');
const hasBlue = iaSection.includes('bg-sky-400');
console.log('\nGreen dot:', hasGreen);
console.log('Yellow dot:', hasYellow);
console.log('Blue dot:', hasBlue);

// 3. Check the header dot area
const headerIdx = c.indexOf('text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full flex items-center gap-1');
if (headerIdx >= 0) {
  const headerSection = c.substring(headerIdx, headerIdx + 400);
  console.log('\n=== HEADER SECTION ===');
  console.log(headerSection);
  const headerHasGreen = headerSection.includes('bg-emerald-400');
  const headerHasYellow = headerSection.includes('bg-yellow-400');
  const headerHasBlue = headerSection.includes('bg-sky-400');
  console.log('\nHeader green dot:', headerHasGreen);
  console.log('Header yellow dot:', headerHasYellow);
  console.log('Header blue dot:', headerHasBlue);
} else {
  console.log('\nHeader pattern not found!');
}

// Check the fontes badges - do THEY have colored dots?
const fontesIdx = c.indexOf('Fontes:');
if (fontesIdx >= 0) {
  const fontesSection = c.substring(fontesIdx, fontesIdx + 600);
  console.log('\n=== FONTES BADGES SECTION ===');
  console.log(fontesSection);
}

console.log('\nDone checking.');
