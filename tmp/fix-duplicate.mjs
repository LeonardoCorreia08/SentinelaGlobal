import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/api-mundiais.ts';
let c = readFileSync(path, 'utf8');

// Find and remove the second extrairLatLon (the duplicate)
const idx1 = c.indexOf('function extrairLatLon');
const idx2 = c.indexOf('function extrairLatLon', idx1 + 10);

if (idx2 >= 0) {
  // Find the end of the second function (next function keyword or significant section)
  const funcEnd = c.indexOf('\n/**', idx2 + 20);
  const funcEnd2 = c.indexOf('\n//', idx2 + 20);
  const removeEnd = funcEnd > 0 ? funcEnd : (funcEnd2 > 0 ? funcEnd2 : idx2 + 200);
  
  // Remove from 'function extrairLatLon' to the next comment/section
  const toRemove = c.substring(idx2, removeEnd);
  c = c.replace(toRemove, '\n');
  
  writeFileSync(path, c);
  console.log('✓ Duplicate extrairLatLon removed');
} else {
  console.log('No duplicate found');
}

// Verify
c = readFileSync(path, 'utf8');
console.log('Count after fix:', (c.match(/function extrairLatLon/g) || []).length);
