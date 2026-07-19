import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/api-mundiais.ts';
let c = readFileSync(path, 'utf8');

// 1. Add fetchComTimeout and fetchUSGS before fetchCemaden
const cemadenIdx = c.indexOf('async function fetchCemaden');
if (cemadenIdx >= 0) {
  const missingFuncs = `
async function fetchComTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ── USGS Earthquakes ────────────────────────────────────────────────

async function fetchUSGS(): Promise<ApiEarthquake[]> {
  try {
    const res = await fetchComTimeout(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
      8000,
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      features: Array<{
        id: string;
        properties: {
          mag: number;
          place: string;
          time: number;
          tsunami: number;
          alert: string | null;
          mmi: number | null;
        };
        geometry: { coordinates: [number, number, number] };
      }>;
    };

    return data.features.map((f) => ({
      id: f.id,
      magnitude: f.properties.mag,
      lugar: f.properties.place || "Local desconhecido",
      timestamp: f.properties.time,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      profundidade_km: f.geometry.coordinates[2],
      tsunami: f.properties.tsunami === 1,
      alerta: f.properties.alert,
      mmi: f.properties.mmi,
    }));
  } catch {
    return [];
  }
}

`;

  c = c.slice(0, cemadenIdx) + missingFuncs + c.slice(cemadenIdx);
  console.log('✓ fetchComTimeout + fetchUSGS added');
}

// 2. Remove duplicate converterDadosParaEventos function
// Find all occurrences and count them
const converterMatches = c.match(/function converterDadosParaEventos/g);
if (converterMatches && converterMatches.length > 1) {
  // Find the second occurrence and remove it
  const firstIdx = c.indexOf('function converterDadosParaEventos');
  const secondIdx = c.indexOf('function converterDadosParaEventos', firstIdx + 10);
  if (secondIdx >= 0) {
    // Find the next export/function after the second converter
    const afterSecondConverter = c.indexOf('\n\nexport', secondIdx);
    const afterFunction = c.indexOf('\n\nfunction', secondIdx + 10);
    const removeEnd = afterSecondConverter > 0 ? afterSecondConverter : (afterFunction > 0 ? afterFunction : secondIdx + 2000);
    const toRemove = c.substring(secondIdx, removeEnd);
    c = c.replace(toRemove, '');
    console.log('✓ Duplicate converterDadosParaEventos removed');
  }
}

// 3. Remove duplicate extrairPais function
const paisMatches = c.match(/function extrairPais/g);
if (paisMatches && paisMatches.length > 1) {
  const firstPaisIdx = c.indexOf('function extrairPais');
  const secondPaisIdx = c.indexOf('function extrairPais', firstPaisIdx + 10);
  if (secondPaisIdx >= 0) {
    // Remove from second extrairPais to end of file (or next section)
    const afterPais = c.indexOf('\n\n', secondPaisIdx + 20);
    const removeEnd = afterPais > 0 ? afterPais : secondPaisIdx + 800;
    const toRemove = c.substring(secondPaisIdx, removeEnd);
    c = c.replace(toRemove, '');
    console.log('✓ Duplicate extrairPais removed');
  }
}

writeFileSync(path, c);
console.log('✓ File saved');
