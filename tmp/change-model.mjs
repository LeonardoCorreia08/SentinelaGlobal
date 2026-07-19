import { readFileSync, writeFileSync } from 'fs';
let c = readFileSync('src/convex/proxyApi.ts', 'utf8');
let before = c;
c = c.replace('"llama-3.3-70b-versatile"', '"mixtral-8x7b-32768"');
if (c !== before) {
  writeFileSync('src/convex/proxyApi.ts', c, 'utf8');
  console.log('✅ Model changed to mixtral-8x7b-32768');
} else {
  console.log('❌ Model string not found');
}
