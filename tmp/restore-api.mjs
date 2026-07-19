import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/api-mundiais.ts';
let c = readFileSync(path, 'utf8');

// Strategy: remove ALL extrairLatLon wrapper calls + the helper function
// Restore original lat/lon assignments

// 1. Remove extrairLatLon function definition
c = c.replace(/function extrairLatLon[\s\S]*?\n\}\n/g, '\n');

// 2. Remove extrairLatLon wrappers (restore lat: value, lon: value)
c = c.replace(/extrairLatLon\(([^)]+)\)/g, '$1');

// 3. Verify no extrairLatLon remains
const remaining = (c.match(/extrairLatLon/g) || []).length;
console.log('Remaining extrairLatLon references:', remaining);

writeFileSync(path, c);
console.log('✓ Saved');
