import { readFileSync, writeFileSync } from 'fs';

const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Fix 1: Change ?? false to ?? true for categoriasExpandidas default
// This makes all categories start expanded so users see all event types
const oldDefault = '?? false;\n                  const maxItens = expandido ? 15 : 5;';
const newDefault = '?? true;\n                  const maxItens = expandido ? 100 : 3;';

if (c.includes(oldDefault)) {
  c = c.replace(oldDefault, newDefault);
  console.log('✓ Category default changed to expanded (?? true)');
} else {
  console.log('⚠ Category default pattern not found, trying alternative...');
  // Check what's actually there
  const marker = 'categoriasExpandidas[cat.tipo]';
  const markerIdx = c.indexOf(marker);
  if (markerIdx >= 0) {
    console.log('Found marker at:', markerIdx);
    console.log('Context:', c.substring(markerIdx, markerIdx + 100));
  }
}

// Fix 2: Change news sort order from timestamp to severity-desc
// This ensures the most impactful events appear in the top 50
const oldSort = 'eventosReais\n          .sort((a, b) => b.timestamp - a.timestamp)\n          .slice(0, 50)';
const newSort = 'eventosReais\n          .sort((a, b) => b.severidade - a.severidade || b.timestamp - a.timestamp)\n          .slice(0, 50)';

if (c.includes(oldSort)) {
  c = c.replace(oldSort, newSort);
  console.log('✓ News sort changed to severity-first');
} else {
  console.log('⚠ News sort pattern not found, checking...');
  const sortIdx = c.indexOf('sort((a, b) => b.timestamp - a.timestamp)');
  if (sortIdx >= 0) {
    console.log('Found sort at:', sortIdx);
    console.log('Context:', c.substring(sortIdx - 40, sortIdx + 80));
  }
}

writeFileSync(path, c);
console.log('✓ Saved');
