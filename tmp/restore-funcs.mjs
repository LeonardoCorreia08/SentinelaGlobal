import { readFileSync, writeFileSync } from 'fs';

const path = 'src/lib/api-mundiais.ts';
let c = readFileSync(path, 'utf8');

// === 1. Restore fetchComTimeout before fetchUSGS ===
const fetchComTimeoutCode = `
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

`;

const fetchUSGSMarker = 'async function fetchUSGS()';
const fetchUSGSIdx = c.indexOf(fetchUSGSMarker);
if (fetchUSGSIdx >= 0) {
  // Insert fetchComTimeout right before fetchUSGS
  c = c.slice(0, fetchUSGSIdx) + fetchComTimeoutCode + c.slice(fetchUSGSIdx);
  console.log('✓ fetchComTimeout restored before fetchUSGS');
} else {
  console.log('⚠ fetchUSGS not found, cannot insert fetchComTimeout');
}

// === 2. Restore fetchGDACS after Cemaden ===
const fetchGDACSCode = `
// ── GDACS Global Disasters ──────────────────────────────────────────

async function fetchGDACS(): Promise<GdacsDisaster[]> {
  try {
    const res = await fetchComTimeout(
      "https://www.gdacs.org/contentdata/xml/gdacs.geojson",
      10000,
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      features: Array<{
        id: string;
        properties: {
          eventtype: string;
          alertlevel: string;
          alertscore: number;
          name: string;
          description: string;
          fromdate: number;
          url: string;
        };
        geometry: { coordinates: [number, number] };
      }>;
    };

    return data.features
      .filter((f) => ["EQ", "TC", "FL", "WF", "VO", "DR"].includes(f.properties.eventtype))
      .map((f) => ({
        id: f.id,
        tipo: f.properties.eventtype as GdacsDisaster["tipo"],
        tipo_nome: GDACS_TIPO_NOME[f.properties.eventtype] || f.properties.eventtype,
        alerta: f.properties.alertlevel as GdacsDisaster["alerta"],
        titulo: f.properties.name || "Desastre sem nome",
        resumo: f.properties.description || "",
        lat: f.geometry.coordinates[1] || 0,
        lon: f.geometry.coordinates[0] || 0,
        timestamp: f.properties.fromdate,
        url: f.properties.url || "",
      }));
  } catch {
    return [];
  }
}

`;

const cemadenEnd = c.indexOf('async function fetchNasaFirms');
if (cemadenEnd >= 0) {
  c = c.slice(0, cemadenEnd) + fetchGDACSCode + c.slice(cemadenEnd);
  console.log('✓ fetchGDACS restored');
} else {
  console.log('⚠ fetchNasaFirms not found');
}

// === 3. Restore converterDadosParaEventos and extrairPais at the end ===
// Find the logDados function and the end of buscarDadosMundiais
const logDadosIdx = c.indexOf('function logDados');
if (logDadosIdx >= 0) {
  // Insert converterDadosParaEventos before logDados
  const converterCode = `
// ═════════════════════════════════════════════════════════════════════
//  CONVERSOR — Dados Mundiais → EventoCombinado
// ═════════════════════════════════════════════════════════════════════

export interface EventoCombinado {
  id: string;
  tipo: string;
  severidade: number;
  lat: number;
  lon: number;
  regiao: string;
  pais: string;
  descricao: string;
  fonte: string;
  timestamp: number;
}

export function converterDadosParaEventos(dados: DadosMundiais): EventoCombinado[] {
  const eventos: EventoCombinado[] = [];

  // USGS → Terremotos
  for (const eq of dados.terremotos) {
    const sev = Math.min(5, Math.max(1, Math.round(eq.magnitude / 1.5)));
    const cidade = eq.lugar.split(",")[0]?.trim() || eq.lugar;
    const pais = eq.lugar.split(",").pop()?.trim() || "Desconhecido";
    eventos.push({
      id: \`usgs_\${eq.id}\`,
      tipo: eq.tsunami ? "tsunami" : "terremoto",
      severidade: sev,
      lat: eq.lat,
      lon: eq.lon,
      regiao: cidade,
      pais: pais,
      descricao: \`Terremoto magnitude \${eq.magnitude} em \${eq.lugar}. Profundidade: \${eq.profundidade_km.toFixed(0)} km. \${eq.tsunami ? "⚠️ Alerta de tsunami ativo!" : ""}\`,
      fonte: "USGS",
      timestamp: eq.timestamp,
    });
  }

  // GDACS → Desastres
  for (const gd of dados.desastres_gdacs) {
    const tipoMap: Record<string, string> = {
      EQ: "terremoto", TC: "ciclone", FL: "enchente",
      WF: "incêndio", VO: "vulcão", DR: "seca",
    };
    const sev = gd.alerta === "Red" ? 5 : gd.alerta === "Orange" ? 4 : 3;
    eventos.push({
      id: \`gdacs_\${gd.id}\`,
      tipo: tipoMap[gd.tipo] || "desastre",
      severidade: sev,
      lat: gd.lat,
      lon: gd.lon,
      regiao: gd.titulo,
      pais: gd.titulo,
      descricao: gd.resumo || \`\${gd.tipo_nome}: \${gd.titulo}\`,
      fonte: "GDACS",
      timestamp: gd.timestamp,
    });
  }

  // Cemaden
  for (const c of dados.cemaden) {
    if (c.chuva_mm !== null && c.lat && c.lon) {
      eventos.push({
        id: \`cemaden_\${c.codigo}\`,
        tipo: "enchente",
        severidade: c.chuva_mm > 50 ? 4 : c.chuva_mm > 30 ? 3 : 2,
        lat: c.lat || -8.05,
        lon: c.lon || -34.88,
        regiao: c.nome,
        pais: "Brasil",
        descricao: \`Estação \${c.nome} registrou \${c.chuva_mm.toFixed(1)}mm de chuva. Risco de alagamento.\`,
        fonte: "Cemaden",
        timestamp: new Date(c.data_hora).getTime(),
      });
    }
  }

  // NASA FIRMS → Queimadas ativas
  for (const f of dados.incendios_nasa) {
    const sev = f.confianca === "high" ? 4 : f.confianca === "nominal" ? 3 : 2;
    eventos.push({
      id: \`firms_\${f.id}\`,
      tipo: "queimada",
      severidade: sev,
      lat: f.latitude,
      lon: f.longitude,
      regiao: f.pais,
      pais: f.pais,
      descricao: \`🔥 Queimada ativa — brilho \${f.brilho}K, FRP \${f.frp.toFixed(1)} MW, confiança \${f.confianca}.\`,
      fonte: "NASA FIRMS",
      timestamp: new Date(f.data_hora).getTime(),
    });
  }

  // NOAA/NWS → Alertas de tsunami
  for (const ts of dados.tsunamis) {
    eventos.push({
      id: \`noaa_tsunami_\${ts.id}\`,
      tipo: "tsunami",
      severidade: ts.severidade,
      lat: 0,
      lon: 0,
      regiao: ts.areas_afetadas,
      pais: ts.areas_afetadas.split(",")[0]?.trim() || "Oceano Pacífico",
      descricao: \`🌊 Alerta de Tsunami: \${ts.titulo}. \${ts.descricao.slice(0, 300)}\`,
      fonte: "NOAA Tsunami",
      timestamp: new Date(ts.timestamp).getTime(),
    });
  }

  // EMSC → Earthquakes
  for (const eq of dados.emsc_earthquakes) {
    const sev = Math.min(5, Math.max(1, Math.round(eq.magnitude / 1.5)));
    eventos.push({
      id: \`emsc_\${eq.id}\`,
      tipo: eq.tsunami ? "tsunami" : "terremoto",
      severidade: sev,
      lat: eq.lat,
      lon: eq.lon,
      regiao: eq.lugar.split(",").pop()?.trim() || eq.lugar,
      pais: extrairPais(eq.lugar),
      descricao: \`Terremoto magnitude \${eq.magnitude} (EMSC) em \${eq.lugar}. Profundidade: \${eq.profundidade_km.toFixed(0)} km.\`,
      fonte: "EMSC",
      timestamp: eq.timestamp,
    });
  }

  return eventos;
}

`;

  c = c.slice(0, logDadosIdx) + converterCode + c.slice(logDadosIdx);
  console.log('✓ converterDadosParaEventos restored');
} else {
  console.log('⚠ logDados not found');
}

// === 4. Restore extrairPais after converterDadosParaEventos ===
// Find the end of the file to append extrairPais
const extrairPaisCode = `
function extrairPais(texto: string): string {
  const paises: Record<string, string> = {
    "Brazil": "Brasil", "Philippines": "Filipinas", "Indonesia": "Indonésia",
    "Japan": "Japão", "Mexico": "México", "Chile": "Chile", "Peru": "Peru",
    "Turkey": "Turquia", "Iran": "Irã", "India": "Índia", "China": "China",
    "Russia": "Rússia", "USA": "EUA", "Alaska": "EUA", "California": "EUA",
    "Hawaii": "EUA", "Italy": "Itália", "Greece": "Grécia", "Iceland": "Islândia",
    "New Zealand": "Nova Zelândia", "Australia": "Austrália", "Canada": "Canadá",
    "France": "França", "Germany": "Alemanha", "United Kingdom": "Reino Unido",
    "Spain": "Espanha", "Portugal": "Portugal", "Argentina": "Argentina",
    "Colombia": "Colômbia", "Venezuela": "Venezuela", "Cuba": "Cuba",
    "Haiti": "Haiti", "Dominican": "República Dominicana", "Puerto Rico": "Porto Rico",
    "South Africa": "África do Sul", "Egypt": "Egito", "Nigeria": "Nigéria",
    "Kenya": "Quênia", "Ethiopia": "Etiópia",
    "Taiwan": "Taiwan", "South Korea": "Coreia do Sul", "Vietnam": "Vietnã",
    "Pakistan": "Paquistão", "Bangladesh": "Bangladesh", "Nepal": "Nepal",
    "Afghanistan": "Afeganistão", "Iraq": "Iraque",
    "Saudi Arabia": "Arábia Saudita", "Israel": "Israel",
  };
  for (const [en, pt] of Object.entries(paises)) {
    if (texto.includes(en)) return pt;
  }
  const partes = texto.split(",").map((s) => s.trim());
  const ultima = partes[partes.length - 1] || texto;
  if (ultima === texto || /^-?\\\\d+\\\\.\\\\d+$/.test(ultima) || ultima === "world") return "Região remota";
  return ultima;
}
`;

// Append extrairPais at the end of the file
if (c.trim().endsWith('}')) {
  // Find last closing brace and insert before it
  const lastBrace = c.lastIndexOf('}');
  if (lastBrace >= 0) {
    c = c.slice(0, lastBrace) + extrairPaisCode + '\n}';
    console.log('✓ extrairPais restored at end of file');
  }
}

writeFileSync(path, c);
console.log('✓ All functions restored');
