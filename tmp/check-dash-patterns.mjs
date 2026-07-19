import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
// Find eventosMundiaisComLatLon
let idx = c.indexOf('eventosMundiaisComLatLon');
if (idx >= 0) {
  console.log('=== eventosMundiaisComLatLon ===');
  console.log(c.substring(idx - 10, idx + 400));
}
// Find eventosMapaLocal  
idx = c.indexOf('eventosMapaLocal');
if (idx >= 0) {
  console.log('=== eventosMapaLocal ===');
  console.log(c.substring(idx - 10, idx + 400));
}
