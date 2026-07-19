import { readFileSync, writeFileSync } from 'fs';

// ====== Patch SentinelaDashboard.tsx ======
let path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// Add latLonValido function and update eventosMapaLocal + eventosMundiaisComLatLon
// Find unique anchor: "Eventos do risco local"
const anchor1 = '// Eventos do risco local (filtrados por raioBusca)';
const idx1 = c.indexOf(anchor1);
if (idx1 >= 0) {
  // Find the block for eventosMapaLocal
  const beforeMap = c.substring(0, idx1);
  const afterMap = c.substring(idx1);
  
  // Find the start of eventosMapaLocal
  const mapaLocalStart = afterMap.indexOf('const eventosMapaLocal =');
  const mapaLocalEnd = afterMap.indexOf('const eventosMundiaisComLatLon');
  
  if (mapaLocalStart >= 0 && mapaLocalEnd >= 0) {
    const oldMapaLocBlock = afterMap.substring(mapaLocalStart, mapaLocalEnd);
    
    const newMapaLocBlock = oldMapaLocBlock
      .replace(
        '.filter(ev => ev.lat !== 0 || ev.lon !== 0) // remove inválidos',
        '.filter(ev => typeof ev.lat === \'number\' && typeof ev.lon === \'number\' && !isNaN(ev.lat) && !isNaN(ev.lon))\n      .filter(ev => (ev.lat !== 0 || ev.lon !== 0)) // remove inválidos'
      )
      .replace(
        'lat: ev.lat,\n        lon: ev.lon,\n        distancia_km: ev.distancia_km,\n        impacto_percentual: ev.impacto_percentual,\n        recomendacao: ev.recomendacao,',
        'lat: typeof ev.lat === \'number\' ? ev.lat : 0,\n        lon: typeof ev.lon === \'number\' ? ev.lon : 0,\n        distancia_km: ev.distancia_km,\n        impacto_percentual: ev.impacto_percentual,\n        recomendacao: ev.recomendacao,'
      );
    
    c = beforeMap + afterMap.replace(oldMapaLocBlock, newMapaLocBlock);
    console.log('✓ eventosMapaLocal patched');
  }
}

// Now patch eventosMundiaisComLatLon
const anchor2 = 'const eventosMundiaisComLatLon = eventosMundiais';
const idx2 = c.indexOf(anchor2);
if (idx2 >= 0) {
  const old = c.substring(idx2, idx2 + 350);
  const newBlock = old
    .replace(
      '.filter(ev => ev.lat !== 0 || ev.lon !== 0)',
      '.filter(ev => typeof ev.lat === \'number\' && typeof ev.lon === \'number\' && !isNaN(ev.lat) && !isNaN(ev.lon))\n    .filter(ev => (ev.lat !== 0 || ev.lon !== 0))'
    )
    .replace(
      'lat: ev.lat,\n      lon: ev.lon,',
      'lat: typeof ev.lat === \'number\' ? ev.lat : 0,\n      lon: typeof ev.lon === \'number\' ? ev.lon : 0,'
    );
  c = c.replace(old, newBlock);
  console.log('✓ eventosMundiaisComLatLon patched');
}

writeFileSync(path, c);
console.log('✓ SentinelaDashboard.tsx saved');

// ====== Verify ======
c = readFileSync(path, 'utf8');
console.log('Has typeof checks:', c.includes('typeof ev.lat'));
console.log('Has latLonValido (should be false):', c.includes('latLonValido'));
