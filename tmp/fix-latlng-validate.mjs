import { readFileSync, writeFileSync } from 'fs';

// ====== Fix 1: converterDadosParaEventos in api-mundiais.ts ======
const apiPath = 'src/lib/api-mundiais.ts';
let apiContent = readFileSync(apiPath, 'utf8');

// Add a helper function for extracting numeric lat/lon
const helperFunc = `
/** Garante que lat/lon sejam números individuais válidos */
function extrairLatLon(valor: unknown, fallback = 0): number {
  if (typeof valor === 'number' && !isNaN(valor)) return valor;
  if (typeof valor === 'string') {
    const parsed = parseFloat(valor);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}
`;

// Add the helper after the WMO_CODIGOS constant
if (apiContent.includes('const WMO_CODIGOS')) {
  // Find the end of WMO_CODIGOS and insert helper after it
  const wmoEndIdx = apiContent.indexOf('};', apiContent.indexOf('const WMO_CODIGOS'));
  if (wmoEndIdx >= 0) {
    const nextSectionStart = apiContent.indexOf('//', wmoEndIdx + 2);
    if (nextSectionStart >= 0) {
      apiContent = apiContent.slice(0, nextSectionStart) + helperFunc + '\n' + apiContent.slice(nextSectionStart);
      writeFileSync(apiPath, apiContent);
      console.log('✓ Helper extrairLatLon added to api-mundiais.ts');
    }
  }
}

// Replace all event pushes that use lat/lon with extrairLatLon wrappers
// Focus on the converterDadosParaEventos function
const replacements = [
  // NASA FIRMS
  { from: "lat: f.latitude,", to: "lat: extrairLatLon(f.latitude)," },
  { from: "lon: f.longitude,", to: "lon: extrairLatLon(f.longitude)," },
  // Cemaden
  { from: "lat: c.lat || -8.05,", to: "lat: extrairLatLon(c.lat, -8.05)," },
  { from: "lon: c.lon || -34.88,", to: "lon: extrairLatLon(c.lon, -34.88)," },
  // EMSC
  { from: "lat: eq.lat,", to: "lat: extrairLatLon(eq.lat)," },
  { from: "lon: eq.lon,", to: "lon: extrairLatLon(eq.lon)," },
  // Volcano
  { from: "lat: vc.lat,", to: "lat: extrairLatLon(vc.lat)," },
  { from: "lon: vc.lon,", to: "lon: extrairLatLon(vc.lon)," },
  // FEMA
  { from: "lat: fm.lat,", to: "lat: extrairLatLon(fm.lat)," },
  { from: "lon: fm.lon,", to: "lon: extrairLatLon(fm.lon)," },
  // Copernicus
  { from: "lat: ca.lat,", to: "lat: extrairLatLon(ca.lat)," },
  { from: "lon: ca.lon,", to: "lon: extrairLatLon(ca.lon)," },
  // NOAA NHC
  { from: "lat: st.lat,", to: "lat: extrairLatLon(st.lat)," },
  { from: "lon: st.lon,", to: "lon: extrairLatLon(st.lon)," },
  // USGS
  { from: "lat: eq.lat,", to: "lat: extrairLatLon(eq.lat)," }, // USGS earthquakes
];

let count = 0;
for (const { from, to } of replacements) {
  if (apiContent.includes(from)) {
    apiContent = apiContent.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    count++;
  }
}
writeFileSync(apiPath, apiContent);
console.log(`✓ ${count} lat/lon assignments wrapped with extrairLatLon`);

// ====== Fix 2: SentinelaDashboard - validate events before rendering markers ======
const dashPath = 'src/pages/SentinelaDashboard.tsx';
let dashContent = readFileSync(dashPath, 'utf8');

// Add validation where event markers are created for map rendering
// Look for eventosMundiaisComLatLon event mapping
const oldEventosMap = `  const eventosMundiaisComLatLon = eventosMundiais
    .filter(ev => ev.lat !== 0 || ev.lon !== 0)
    .map(ev => ({
      id: ev.id,
      tipo: ev.tipo,
      severidade: ev.severidade,
      lat: ev.lat,
      lon: ev.lon,
      distancia_km: 0,
      impacto_percentual: Math.round(ev.severidade * 20),
      recomendacao: \`Evento de \${ev.tipo} em \${ev.pais} — Fonte: \${ev.fonte}\`,
    }));`;

const newEventosMap = `  function latLonValido(val: unknown): val is number {
    return typeof val === 'number' && !isNaN(val) && isFinite(val);
  }

  const eventosMundiaisComLatLon = eventosMundiais
    .filter(ev => {
      const latOk = latLonValido(ev.lat) && ev.lat !== 0;
      const lonOk = latLonValido(ev.lon) && ev.lon !== 0;
      return latOk || lonOk;
    })
    .map(ev => ({
      id: ev.id,
      tipo: ev.tipo,
      severidade: ev.severidade,
      lat: latLonValido(ev.lat) ? ev.lat : 0,
      lon: latLonValido(ev.lon) ? ev.lon : 0,
      distancia_km: 0,
      impacto_percentual: Math.round(ev.severidade * 20),
      recomendacao: \`Evento de \${ev.tipo} em \${ev.pais} — Fonte: \${ev.fonte}\`,
    }));`;

if (dashContent.includes(oldEventosMap)) {
  dashContent = dashContent.replace(oldEventosMap, newEventosMap);
  writeFileSync(dashPath, dashContent);
  console.log('✓ eventosMundiaisComLatLon validation added');
} else {
  console.log('⚠ eventosMundiaisComLatLon pattern not found, checking...');
  const idx = dashContent.indexOf('eventosMundiaisComLatLon');
  if (idx >= 0) {
    console.log('  Found at char:', idx);
    console.log('  Context:', dashContent.substring(idx, idx + 300));
  }
}

// ====== Fix 3: Add validation in eventosMapaLocal too ======
const oldEventosMapa = `  const eventosMapaLocal =
    analise?.eventos_analisados
      .filter(ev => ev.lat !== 0 || ev.lon !== 0)
      .filter(ev => !ev.id.startsWith("noaa_tsunami_"))
      .map(ev => ({`;

const newEventosMapa = `  const eventosMapaLocal =
    analise?.eventos_analisados
      .filter(ev => latLonValido(ev.lat) && latLonValido(ev.lon))
      .filter(ev => (ev.lat !== 0 || ev.lon !== 0))
      .filter(ev => !ev.id.startsWith("noaa_tsunami_"))
      .map(ev => ({`;

if (dashContent.includes(oldEventosMapa)) {
  dashContent = dashContent.replace(oldEventosMapa, newEventosMapa);
  writeFileSync(dashPath, dashContent);
  console.log('✓ eventosMapaLocal validation added');
} else {
  console.log('⚠ eventosMapaLocal pattern not found');
  const idx = dashContent.indexOf('eventosMapaLocal');
  if (idx >= 0) {
    console.log('  Found at char:', idx);
    console.log('  Context:', dashContent.substring(idx, idx + 250));
  }
}

console.log('✓ All fixes applied');
