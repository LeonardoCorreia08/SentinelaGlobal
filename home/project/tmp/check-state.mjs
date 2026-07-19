import { readFileSync } from 'node:fs';

// Check api-mundiais.ts
const c = readFileSync('src/lib/api-mundiais.ts', 'utf8');
const lines = c.split('\n');
console.log('=== api-mundiais.ts ===');
console.log('Total lines:', lines.length);

// Find all function definitions
for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const fnMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
  if(fnMatch) {
    console.log(`  ${i+1}: function ${fnMatch[1]}`);
  }
  const constFnMatch = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s*)?[=(]/);
  if(constFnMatch) {
    console.log(`  ${i+1}: const ${constFnMatch[1]}`);
  }
}

// Check for duplicates
const fnNames = [];
for(let i = 0; i < lines.length; i++) {
  const fnMatch = lines[i].match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
  if(fnMatch) fnNames.push(fnMatch[1]);
  const constFnMatch = lines[i].match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s*)?[=(]/);
  if(constFnMatch) fnNames.push(constFnMatch[1]);
}
const counts = {};
for(const name of fnNames) {
  counts[name] = (counts[name] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([n,c]) => c > 1);
if(dupes.length > 0) {
  console.log('\n⚠️ DUPLICATE functions:');
  for(const [name, count] of dupes) console.log(`  ${name}: ${count} times`);
} else {
  console.log('\n✅ No duplicates');
}

console.log('\n=== .env.local ===');
try {
  const env = readFileSync('.env.local', 'utf8');
  console.log(env);
} catch(e) {
  console.log('NOT FOUND');
}

console.log('\n=== vite.config.ts (first 30 lines) ===');
const vc = readFileSync('vite.config.ts', 'utf8');
console.log(vc.substring(0, 800));
