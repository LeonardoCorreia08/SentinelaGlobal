import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/api-mundiais.ts';
let c = readFileSync(path, 'utf8');
const before = c;

// Replace hardcoded OWM_KEY fallback with null
c = c.replace(
  /const OWM_KEY = \(import\.meta\.env as Record<string, string \| undefined>\)\["VITE_OWM_KEY"\] \|\| "[^"]+";/,
  'const OWM_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_OWM_KEY"] || null;'
);

// Replace hardcoded WEATHERAPI_KEY fallback with null
c = c.replace(
  /const WEATHERAPI_KEY = \(import\.meta\.env as Record<string, string \| undefined>\)\["VITE_WEATHERAPI_KEY"\] \|\| "[^"]+";/,
  'const WEATHERAPI_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_WEATHERAPI_KEY"] || null;'
);

// Replace hardcoded NASA_FIRMS_KEY fallback with null
c = c.replace(
  /const NASA_FIRMS_KEY = \(import\.meta\.env as Record<string, string \| undefined>\)\["VITE_NASA_FIRMS_KEY"\] \|\| "[^"]+";/,
  'const NASA_FIRMS_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_NASA_FIRMS_KEY"] || null;'
);

if (before !== c) {
  writeFileSync(path, c, 'utf8');
  console.log('✅ Hardcoded API keys removed from browser code');
  console.log('Files now rely solely on Convex proxy for API calls');
} else {
  console.log('⚠️ No changes - searching for patterns...');
  const lines = c.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('OWM_KEY') || l.includes('WEATHERAPI_KEY') || l.includes('NASA_FIRMS_KEY')) {
      console.log(`${i + 1}: ${l.trim()}`);
    }
  });
}
