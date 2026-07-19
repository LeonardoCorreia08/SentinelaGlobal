const fs = require('fs');

// Check api-mundiais.ts
const c = fs.readFileSync('src/lib/api-mundiais.ts', 'utf8');
const lines = c.split('\n');
console.log('=== api-mundiais.ts ===');
console.log('Total lines:', lines.length);

// Find all function definitions
for(let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match function declarations
  const fnMatch = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
  if(fnMatch) {
    console.log(`  ${i+1}: function ${fnMatch[1]}`);
  }
  // Match const foo = ( ... ) => or const foo = async ( ... ) => or const foo = function
  const constFnMatch = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s*)?[=(]/);
  if(constFnMatch && !line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*:\s*\w+\s*[=]/)) {
    console.log(`  ${i+1}: const ${constFnMatch[1]}`);
  }
}

console.log('\n=== .env.local ===');
try {
  const env = fs.readFileSync('.env.local', 'utf8');
  console.log(env);
} catch(e) {
  console.log('NOT FOUND');
}

console.log('\n=== vite.config.ts ===');
const vc = fs.readFileSync('vite.config.ts', 'utf8');
console.log(vc.substring(0, 1000));
