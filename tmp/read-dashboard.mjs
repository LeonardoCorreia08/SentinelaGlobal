import { readFileSync } from 'fs';
const content = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
// Find MapContainer lines
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('MapContainer') || lines[i].includes('SafeCircle') || lines[i].includes('L.latLng') || lines[i].includes('latLngBounds') || lines[i].includes('Circle')) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
