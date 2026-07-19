/**
 * src/lib/api-mundiais.ts
 *
 * Integração com APIs REAIS de monitoramento de desastres ao redor do mundo:
 *   - USGS   → Terremotos e tsunamis (geoJSON público, sem chave)
 *   - GDACS  → Desastres globais: ciclones, enchentes, vulcões, incêndios (geoJSON público)
 *   - Cemaden→ Monitoramento de chuvas e estações no Brasil (APAC PE)
 *   - Open-Meteo → Dados meteorológicos atuais (temperatura, precipitação, vento)
 */

// ═════════════════════════════════════════════════════════════════════
//  SISTEMA DE FALLBACK EM CADEIA
// ═════════════════════════════════════════════════════════════════════

/** Cache simples para dados que mudam lentamente (vulcões, queimadas) */
const cacheDeEventos = new Map<string, { dados: unknown; timestamp: number }>();
const TEMPO_CACHE_MS = 10 * 60 * 1000; // 10 minutos

function obterCache<T>(chave: string): T | null {
  const item = cacheDeEventos.get(chave);
  if (item && Date.now() - item.timestamp < TEMPO_CACHE_MS) {
    return item.dados as T;
  }
  return null;
}

function definirCache<T>(chave: string, dados: T): void {
  cacheDeEventos.set(chave, { dados, timestamp: Date.now() });
}

// ═════════════════════════════════════════════════════════════════════
//  REVERSE GEOCODING — Nominatim (OpenStreetMap)
// ═════════════════════════════════════════════════════════════════════

/** Cache para resultados de reverse geocoding (Nominatim exige cache) */
const cacheGeocode = new Map<string, { nome: string; timestamp: number }>();
const TEMPO_CACHE_GEOCODE_MS = 24 * 60 * 60 * 1000; // 24 horas
let ultimaChamadaNominatim = 0;

/**
 * Busca o NOME REAL de um local a partir de coordenadas,
 * usando a API Nominatim do OpenStreetMap (grátis, sem chave).
 *
 * Respeita a política de uso: máx 1 requisição/segundo,
 * resultados cacheados por 24h, User-Agent obrigatório.
 */
export async function buscarNomeLocal(lat: number, lon: number): Promise<string | null> {
  const chave = `${lat.toFixed(4)},${lon.toFixed(4)}`;

  // Tenta cache primeiro (política do Nominatim exige cache)
  const cache = cacheGeocode.get(chave);
  if (cache && Date.now() - cache.timestamp < TEMPO_CACHE_GEOCODE_MS) {
    return cache.nome;
  }

  // Rate limiting: no mínimo 1s entre requisições
  const agora = Date.now();
  const tempoEspera = 1000 - (agora - ultimaChamadaNominatim);
  if (tempoEspera > 0) {
    await new Promise((resolve) => setTimeout(resolve, tempoEspera));
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&accept-language=pt`,
      {
        headers: {
          "User-Agent": "SentinelaGlobal/1.0 (monitoramento@sentinela.app)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    ultimaChamadaNominatim = Date.now();

    if (!res.ok) return null;

    const data = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
      };
    };

    // Extrai o melhor nome disponível (cidade > vila > estado > nome)
    const nome = data.address?.city
      || data.address?.town
      || data.address?.village
      || data.address?.state
      || data.name
      || data.display_name?.split(",")[0]?.trim()
      || null;

    if (nome) {
      cacheGeocode.set(chave, { nome, timestamp: Date.now() });
    }

    return nome;
  } catch {
    return null;
  }
}

/**
 * Fallback offline: converte coordenadas em nome de região aproximado
 * usando um grid de continentes/oceanos. Útil quando Nominatim falha
 * ou está rate-limited. Cobre TODAS as coordenadas do globo.
 */
function coordsParaNomeAproximado(lat: number, lon: number): string {
  // ── Oceanos & Antártida ──
  if (lat < -60) {
    if (lon > -180 && lon < -70) return "Oceano Antártico";
    return "Antártida";
  }

  if (lat > 65 && lon > -180 && lon < -30) return "Oceano Ártico";
  if (lat > 65 && lon > -30 && lon < 180) return "Ártico";

  // ── América do Sul ──
  if (lat > -60 && lat < 15 && lon > -82 && lon < -34) {
    if (lat > -35 && lat < -15 && lon > -70 && lon < -57) return "América do Sul";
    if (lat > -55 && lat < -33 && lon > -75 && lon < -65) return "América do Sul (Patagônia)";
    if (lon > -50 && lon < -35) return "América do Sul (Brasil)";
    if (lon < -75) return "Cordilheira dos Andes";
    return "América do Sul";
  }

  // ── Havaí (antes da América do Norte para evitar conflito) ──
  if (lon > -160 && lon < -145 && lat > 18 && lat < 23) return "Havaí";

  // ── Groenlândia ──
  if (lat > 60 && lat < 85 && lon > -75 && lon < -20) {
    if (lat > 70) return "Groenlândia";
    return "América do Norte (Groenlândia)";
  }

  // ── América Central & Caribe ──
  if (lat > 5 && lat < 33 && lon > -115 && lon < -80) {
    if (lat > 14 && lat < 33 && lon > -118 && lon < -95) return "México";
    if (lat > 7 && lat < 24 && lon > -90 && lon < -60) return "Caribe";
    return "América Central";
  }

  // ── América do Norte ──
  if (lat > 15 && lat < 65 && lon > -170 && lon < -50) {
    if (lat > 48 && lon > -130 && lon < -110) return "América do Norte (Canadá)";
    if (lat > 24 && lat < 50 && lon > -125 && lon < -66) return "América do Norte";
    return "América do Norte";
  }

  // ── Oriente Médio (antes da África para evitar conflito no Sinai/Arábia) ──
  if (lat > 12 && lat < 42 && lon > 32 && lon < 80) {
    return "Oriente Médio";
  }

  // ── África ──
  if (lat > -35 && lat < 38 && lon > -18 && lon < 32) {
    if (lat > -35 && lat < 5 && lon > 8 && lon < 30) return "África Central";
    if (lat > 5 && lat < 20 && lon > -18 && lon < 15) return "África Ocidental";
    if (lat > 15 && lat < 38 && lon > -10 && lon < 15) return "Norte da África";
    if (lat > -5 && lat < 15 && lon > 15 && lon < 32) return "África Central";
    if (lat > -35 && lat < -5 && lon > 10 && lon < 40) return "África Austral";
    return "África";
  }

  // ── Europa ──
  if (lat > 36 && lat < 65 && lon > -10 && lon < 40) {
    if (lat > 55 && lon < 30) return "Europa Setentrional";
    return "Europa";
  }

  // ── Rússia/Sibéria (antes do Ártico para capturar norte da Rússia) ──
  if (lat > 50 && lat < 80 && lon > 40 && lon < 180) {
    if (lon < 60) return "Rússia Europeia";
    return "Sibéria";
  }

  // ── Ásia Central ──
  if (lat > 30 && lat < 50 && lon > 50 && lon < 95) {
    return "Ásia Central";
  }

  // ── Sul da Ásia ──
  if (lat > 5 && lat < 37 && lon > 60 && lon < 100) {
    if (lat > 5 && lat < 25 && lon > 75 && lon < 100) return "Ásia Meridional";
    return "Ásia Meridional";
  }

  // ── Sudeste Asiático ──
  if (lat > -12 && lat < 30 && lon > 95 && lon < 145) {
    if (lat > -10 && lat < 8 && lon > 95 && lon < 120) return "Sudeste Asiático";
    if (lat > 10 && lat < 25 && lon > 95 && lon < 110) return "Sudeste Asiático";
    return "Sudeste Asiático";
  }

  // ── Ásia Oriental ──
  if (lat > 20 && lat < 50 && lon > 95 && lon < 150) {
    if (lat > 30 && lat < 45 && lon > 120 && lon < 135) return "Ásia Oriental";
    if (lat > 20 && lat < 35 && lon > 115 && lon < 125) return "Ásia Oriental";
    return "Ásia Oriental";
  }

  // ── Austrália / Oceania ──
  if (lat > -50 && lat < -10 && lon > 110 && lon < 180) {
    if (lat > -40 && lat < -25 && lon > 110 && lon < 155) return "Austrália";
    if (lat > -50 && lat < -30 && lon > 160 && lon < 180) return "Nova Zelândia";
    return "Oceania";
  }

  // ── Oceanos restantes (depois de todos os continentes) ──
  // Pacífico
  if (lon > -180 && lon < -80 && lat > -60 && lat < 65) {
    if (lat > -30 && lat < 30) return "Oceano Pacífico";
    if (lat > 30) return "Oceano Pacífico Norte";
    return "Oceano Pacífico Sul";
  }
  if (lon > 120 && lon < 180 && lat > -60 && lat < 65) {
    if (lat > -30 && lat < 30) return "Oceano Pacífico";
    return "Oceano Pacífico";
  }

  // Atlântico
  if (lon > -80 && lon < -20 && lat > 15 && lat < 65) return "Oceano Atlântico Norte";
  if (lon > -60 && lon < 20 && lat > -60 && lat < 15) return "Oceano Atlântico Sul";

  // Índico
  if (lon > 20 && lon < 120 && lat > -50 && lat < 25) {
    if (lat > -10 && lat < 25) return "Oceano Índico";
    return "Oceano Índico";
  }

  // Mar Mediterrâneo
  if (lat > 30 && lat < 45 && lon > -5 && lon < 35) return "Mar Mediterrâneo";

  // Ártico / Oceano Ártico (só depois de todos os continentes)
  if (lat > 65) {
    if (lon > -180 && lon < -30) return "Oceano Ártico";
    return "Ártico";
  }

  return "Região remota";
}

/**
 * Enriquece eventos que têm "Região remota" como local com o nome real
 * obtido via reverse geocoding. Útil para queimadas e outros eventos
 * que só têm coordenadas.
 *
 * Retorna os eventos atualizados (com `pais` e `regiao` preenchidos).
 */
export async function enriquecerLocalizacao(
  eventos: EventoCombinado[],
): Promise<EventoCombinado[]> {
  const eventosAtualizados = [...eventos];

  for (let i = 0; i < eventosAtualizados.length; i++) {
    const ev = eventosAtualizados[i];
    // Só busca se estiver como "Região remota"
    if (ev.pais !== "Região remota") continue;

    try {
      // ⚡ Nominatim desativado temporariamente para evitar flood de erros no console.
      // Usa apenas fallback offline por coordenadas.
      const nome = coordsParaNomeAproximado(ev.lat, ev.lon);
      if (nome) {
        eventosAtualizados[i] = { ...ev, pais: nome, regiao: nome };
      }
    } catch {
      // Continua para o próximo evento
    }
  }

  return eventosAtualizados;
}

/**
 * Helper de fallback em cadeia: tenta fonte primária, depois secundária.
 * Cada fonte tem um timeout individual. Se todas falharem, retorna fallback vazio.
 */
async function fetchComFallback<T>(
  primaria: () => Promise<T[]>,
  secundaria: () => Promise<T[]>,
  chaveCache?: string,
): Promise<T[]> {
  // Tenta cache primeiro
  if (chaveCache) {
    const cache = obterCache<T[]>(chaveCache);
    if (cache) return cache;
  }

  // Tenta primária
  try {
    const resultado = await primaria();
    if (resultado.length > 0) {
      if (chaveCache) definirCache(chaveCache, resultado);
      return resultado;
    }
  } catch {
    // Primária falhou — tenta secundária
  }

  // Fallback: tenta secundária
  try {
    const resultado = await secundaria();
    if (resultado.length > 0) {
      if (chaveCache) definirCache(chaveCache, resultado);
      return resultado;
    }
  } catch {
    // Ambas falharam
  }

  return [];
}

// ═════════════════════════════════════════════════════════════════════
//  TIPOS DE RETORNO
// ═════════════════════════════════════════════════════════════════════

export interface ApiEarthquake {
  id: string;
  magnitude: number;
  lugar: string;
  timestamp: number;
  lat: number;
  lon: number;
  profundidade_km: number;
  tsunami: boolean;
  alerta: string | null;
  mmi: number | null;
}

export interface GdacsDisaster {
  id: string;
  tipo: "EQ" | "TC" | "FL" | "WF" | "VO" | "DR";
  tipo_nome: string;
  alerta: "Green" | "Orange" | "Red";
  titulo: string;
  resumo: string;
  lat: number;
  lon: number;
  timestamp: number;
  url: string;
}

export interface CemadenEstacao {
  nome: string;
  codigo: string;
  data_hora: string;
  chuva_mm: number | null;
  lat: number | null;
  lon: number | null;
}

export interface OpenMeteoData {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  precipitacao_diaria_mm: number | null;
  prob_precipitacao_max: number | null;
  codigo_tempo_diario: number | null;
  // Previsão próximas 6h
  precipitacao_horaria_proximas_6h: number[];
  probabilidade_horaria_proximas_6h: number[];
  codigos_tempo_horarios: number[];
  // Histórico 24h
  precipitacao_horaria_24h: number[];
  probabilidade_horaria_24h: number[];
  codigos_tempo_24h: number[];
  horarios_24h: string[];
}

export interface NasaFirmsFire {
  id: string;
  latitude: number;
  longitude: number;
  brilho: number; // brightness in Kelvin
  confianca: string; // low, nominal, high
  frp: number; // Fire Radiative Power
  data_hora: string;
  pais: string;
}

export interface NwsTsunamiAlert {
  id: string;
  titulo: string;
  descricao: string;
  areas_afetadas: string;
  severidade: number;
  timestamp: string;
  url: string;
}

export interface EmscEarthquake {
  id: string;
  magnitude: number;
  lugar: string;
  timestamp: number;
  lat: number;
  lon: number;
  profundidade_km: number;
  tsunami: boolean;
}

export interface UsgsVolcano {
  id: string;
  nome: string;
  status: string;
  descricao: string;
  lat: number;
  lon: number;
  pais: string;
  severidade: number;
  timestamp: number;
}

export interface FemaDisaster {
  id: string;
  tipo: string;
  tipo_nome: string;
  titulo: string;
  descricao: string;
  severidade: number;
  lat: number;
  lon: number;
  area: string;
  timestamp: number;
}

// ── Copernicus EMS (queimadas, enchentes) ───────────────────────────
export interface CopernicusActivation {
  id: string;
  tipo: string; // wildfire, flood, storm, earthquake
  titulo: string;
  descricao: string;
  pais: string;
  lat: number;
  lon: number;
  severidade: number;
  timestamp: number;
}

// ── NOAA NHC (furacões) ───────────────────────────────────────────────
export interface NoaaNhcStorm {
  id: string;
  nome: string;
  tipo: string; // Tropical Storm, Hurricane, etc.
  intensidade: number; // categoria (1-5)
  vento_max_kt: number;
  lat: number;
  lon: number;
  timestamp: number;
  movimento: string;
}

// ── OpenWeatherMap (precipitação) ──────────────────────────────────────
export interface OWMData {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  umidade: number | null;
}

// ── WeatherAPI (precipitação) ───────────────────────────────────────────
export interface WeatherApiData {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  umidade: number | null;
}

export interface DadosMundiais {
  terremotos: ApiEarthquake[];
  desastres_gdacs: GdacsDisaster[];
  cemaden: CemadenEstacao[];
  meteo: OpenMeteoData | null;
  incendios_nasa: NasaFirmsFire[];
  tsunamis: NwsTsunamiAlert[];
  emsc_earthquakes: EmscEarthquake[];
  volcanoes: UsgsVolcano[];
  fema_disasters: FemaDisaster[];
  copernicus_activations: CopernicusActivation[];
  noaa_nhc_storms: NoaaNhcStorm[];
  owm: OWMData | null;
  weatherapi: WeatherApiData | null;
  inmet_precip_mm: number | null;
  inmet_estacao: string | null;
  timestamp_coleta: string;
  fontes: string[];
}

// ═════════════════════════════════════════════════════════════════════
//  CONSTANTES
// ═════════════════════════════════════════════════════════════════════

const GDACS_TIPO_NOME: Record<string, string> = {
  EQ: "Terremoto", TC: "Ciclone Tropical", FL: "Enchente",
  WF: "Incêndio Florestal", VO: "Vulcão", DR: "Seca",
};

const WMO_CODIGOS: Record<number, { nome: string; severo: boolean }> = {
  0:  { nome: "Céu limpo", severo: false },
  1:  { nome: "Predom. limpo", severo: false },
  2:  { nome: "Parcial. nublado", severo: false },
  3:  { nome: "Encoberto", severo: false },
  45: { nome: "Nevoeiro", severo: false },
  48: { nome: "Nevoeiro com geada", severo: false },
  51: { nome: "Chuvisco leve", severo: false },
  53: { nome: "Chuvisco moderado", severo: false },
  55: { nome: "Chuvisco intenso", severo: false },
  56: { nome: "Chuvisco congelante leve", severo: true },
  57: { nome: "Chuvisco congelante intenso", severo: true },
  61: { nome: "Chuva leve", severo: false },
  63: { nome: "Chuva moderada", severo: false },
  65: { nome: "Chuva intensa", severo: true },
  66: { nome: "Chuva congelante leve", severo: true },
  67: { nome: "Chuva congelante intensa", severo: true },
  71: { nome: "Neve leve", severo: false },
  73: { nome: "Neve moderada", severo: false },
  75: { nome: "Neve intensa", severo: true },
  77: { nome: "Grãos de neve", severo: false },
  80: { nome: "Pancadas chuva leve", severo: false },
  81: { nome: "Pancadas chuva moderada", severo: false },
  82: { nome: "Pancadas chuva violenta", severo: true },
  85: { nome: "Pancadas neve leve", severo: false },
  86: { nome: "Pancadas neve intensa", severo: true },
  95: { nome: "Tempestade fraca", severo: true },
  96: { nome: "Tempestade c/ granizo leve", severo: true },
  99: { nome: "Tempestade c/ granizo forte", severo: true },
};


/** Garante que lat/lon sejam números individuais válidos */



/** Garante que lat/lon sejam números individuais válidos */


/**
 * Cemaden removido — API HTTP bloqueada por mixed content em HTTPS.
 * Os dados de chuva Brazil são obtidos via Open-Meteo + INMET.
 */

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

async function fetchCemaden(): Promise<CemadenEstacao[]> {
  return [];
}

// ── NASA FIRMS (queimadas) — requer MAP_KEY gratuita ───────────────
// Obtenha sua chave gratuita em https://firms.modaps.eosdis.nasa.gov/api/map_key/
// Configure via env var VITE_NASA_FIRMS_KEY na aba Keys/API keys

// Sua MAP_KEY gratuita da NASA FIRMS (configure via env var VITE_NASA_FIRMS_KEY na aba Keys/API keys)
const NASA_FIRMS_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_NASA_FIRMS_KEY"] || null;


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

async function fetchNasaFirms(): Promise<NasaFirmsFire[]> {
  try {
    // Sem chave NASA FIRMS — retorna vazio (dados reais apenas)
    if (!NASA_FIRMS_KEY) return [];

    // API real da NASA FIRMS
    const res = await fetchComTimeout(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_FIRMS_KEY}/VIIRS_SNPP_NRT/world/1`,
      10000,
    );
    if (!res.ok) return [];

    const csv = await res.text();
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",");
    const latIdx = headers.indexOf("latitude");
    const lonIdx = headers.indexOf("longitude");
    const briIdx = headers.indexOf("bright_ti4");
    const confIdx = headers.indexOf("confidence");
    const frpIdx = headers.indexOf("frp");
    const acqIdx = headers.indexOf("acq_date_time");

    return lines.slice(1, 30).map((line, i) => {
      const cols = line.split(",");
      return {
        id: `nasa_firms_${i}`,
        latitude: parseFloat(cols[latIdx] || "0"),
        longitude: parseFloat(cols[lonIdx] || "0"),
        brilho: parseFloat(cols[briIdx] || "0"),
        confianca: cols[confIdx] || "nominal",
        frp: parseFloat(cols[frpIdx] || "0"),
        data_hora: cols[acqIdx] || new Date().toISOString(),
        pais: extrairPais(`${cols[latIdx]},${cols[lonIdx]}`),
      };
    });
  } catch {
    return [];
  }
}// ── EMSC (European Mediterranean Seismological Centre) ──────────
// API pública FDSN, sem chave, CORS-friendly
// Docs: https://www.seismicportal.eu/fdsnws/event/1/

async function fetchEMSC(): Promise<EmscEarthquake[]> {
  try {
    const res = await fetchComTimeout(
      "https://www.seismicportal.eu/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=20",
      8000,
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      features: Array<{
        id: string;
        properties: {
          mag: number;
          flynn_region: string;
          time: number;
          depth: number;
        };
        geometry: { coordinates: [number, number, number] };
      }>;
    };

    return data.features.map((f) => ({
      id: f.id,
      magnitude: f.properties.mag,
      lugar: f.properties.flynn_region || "Região desconhecida",
      timestamp: f.properties.time,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      profundidade_km: f.properties.depth,
      tsunami: false,
    }));
  } catch {
    return [];
  }
}

// ── USGS Volcano Hazards Program ────────────────────────────────────
// API pública: https://volcanoes.usgs.gov/volcanoes/services/

async function fetchUSGSVolcanoes(): Promise<UsgsVolcano[]> {
  try {
    const res = await fetchComTimeout(
      "https://volcanoes.usgs.gov/hans-public/api/volcano/list",
      10000,
    );
    if (!res.ok) return [];

    const data = await res.json() as Array<{
      id: number;
      name: string;
      status: string;
      description: string;
      latitude: number;
      longitude: number;
      country: string;
      lastEruptionDate: string;
    }>;

    if (!Array.isArray(data)) return [];

    return data
      .filter((v) => v.latitude && v.longitude && v.status)
      .slice(0, 20)
      .map((v) => {
        const sev = v.status === "Erupting" ? 5
          : v.status === "Unrest" ? 3
          : v.status === "Watch" ? 4
          : 2;
        return {
          id: String(v.id),
          nome: v.name || "Vulcão sem nome",
          status: v.status || "Normal",
          descricao: v.description?.slice(0, 200) || v.status,
          lat: v.latitude,
          lon: v.longitude,
          pais: v.country || "Desconhecido",
          severidade: sev,
          timestamp: v.lastEruptionDate
            ? new Date(v.lastEruptionDate).getTime()
            : Date.now(),
        };
      });
  } catch {
    return [];
  }
}

// ── OpenFEMA - US Disaster Declarations ─────────────────────────────
// API pública: https://www.fema.gov/openfema-api

async function fetchOpenFEMA(): Promise<FemaDisaster[]> {
  try {
    const res = await fetchComTimeout(
      "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?" +
      "$filter=incidentType%20eq%20%27Fire%27%20or%20incidentType%20eq%20%27Hurricane%27%20or%20" +
      "incidentType%20eq%20%27Earthquake%27%20or%20incidentType%20eq%20%27Flood%27%20or%20" +
      "incidentType%20eq%20%27Severe%20Storm%27&$orderby=incidentBeginDate%20desc&$top=15",
      10000,
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      DisasterDeclarationsSummaries: Array<{
        id: number;
        incidentType: string;
        declarationTitle: string;
        incidentBeginDate: string;
        state: string;
        placeCode: string;
        incidentTypeCode: string;
      }>;
    };

    if (!data.DisasterDeclarationsSummaries) return [];

    return data.DisasterDeclarationsSummaries.map((d) => {
      const tipoMap: Record<string, string> = {
        Fire: "incêndio", Hurricane: "furacão",
        Earthquake: "terremoto", Flood: "enchente",
        "Severe Storm": "tempestade",
      };
      const tipo = tipoMap[d.incidentType] || "desastre";
      const sev = d.incidentType === "Hurricane" ? 4
        : d.incidentType === "Earthquake" ? 4
        : d.incidentType === "Fire" ? 3
        : 2;
      // Aproximação de coordenadas por estado
      const estadoLatLon: Record<string, [number, number]> = {
        CA: [36.8, -119.8], FL: [27.8, -81.5], TX: [31.5, -99.3],
        LA: [31.0, -92.4], AL: [32.8, -86.8], MS: [32.7, -89.4],
        GA: [32.6, -83.4], NC: [35.5, -79.4], SC: [33.9, -81.2],
        OK: [35.6, -97.5], CO: [39.0, -105.5], OR: [44.0, -120.5],
        WA: [47.5, -120.5], MT: [47.0, -110.0], AZ: [34.0, -112.0],
        NM: [34.5, -106.0], NV: [39.5, -116.5], UT: [39.5, -111.5],
        NY: [42.8, -75.5], PA: [41.2, -77.2], OH: [40.3, -82.8],
        IN: [40.0, -86.2], IL: [40.0, -89.0], MI: [44.3, -84.5],
        WI: [44.5, -89.5], MN: [46.4, -94.6], IA: [42.0, -93.4],
        MO: [38.5, -92.5], AR: [34.8, -92.2], TN: [35.8, -86.5],
        KY: [37.5, -85.6], WV: [38.6, -80.6], VA: [37.5, -78.8],
        HI: [21.3, -157.8], AK: [64.0, -150.0], PR: [18.2, -66.6],
      };
      const coords = estadoLatLon[d.state] || [38.0, -98.0];
      return {
        id: String(d.id),
        tipo,
        tipo_nome: d.incidentType,
        titulo: d.declarationTitle || `${d.incidentType} em ${d.state}`,
        descricao: `Desastre ${d.incidentType} declarado em ${d.state} — ${d.declarationTitle || "Emergência"}.`,
        severidade: sev,
        lat: coords[0],
        lon: coords[1],
        area: `${d.state}`,
        timestamp: new Date(d.incidentBeginDate).getTime(),
      };
    });
  } catch {
    return [];
  }
}

// ── Copernicus EMS - Emergency Management Service (queimadas, enchentes) ──
// API pública gratuita, sem chave necessária
// Docs: https://emergency.copernicus.eu/mapping/activations-rapid

async function fetchCopernicusEMS(): Promise<CopernicusActivation[]> {
  try {
    const res = await fetchComTimeout(
      "https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=20&ordering=-published",
      10000,
    );
    if (!res.ok) return [];

    const data = await res.json() as Array<{
      id: number;
      name: string;
      description: string;
      country: string;
      latitude: number;
      longitude: number;
      event_type: string;
      published: string;
    }>;

    if (!Array.isArray(data)) return [];

    return data
      .filter((a) => a.latitude && a.longitude)
      .slice(0, 15)
      .map((a) => {
        const tipoMap: Record<string, string> = {
          WF: "incêndio", FF: "enchente", ST: "tempestade",
          EQ: "terremoto", VO: "vulcão", DR: "seca",
          IND: "incêndio", FL: "enchente",
        };
        const tipo = tipoMap[a.event_type] || "desastre";
        const sev = a.event_type === "WF" || a.event_type === "IND" ? 4
          : a.event_type === "FF" || a.event_type === "FL" ? 3
          : 2;
        return {
          id: `copernicus_${a.id}`,
          tipo,
          titulo: a.name || `Ativação ${a.id}`,
          descricao: a.description?.slice(0, 200) || `Evento ${a.event_type} em ${a.country}`,
          pais: a.country || "Desconhecido",
          lat: a.latitude,
          lon: a.longitude,
          severidade: sev,
          timestamp: new Date(a.published).getTime(),
        };
      });
  } catch {
    return [];
  }
}

// ── NOAA NHC - Atlantic Tropical Cyclones (furacões) ────────────────
// GIS data em formato GeoJSON, sem chave
// Dados: https://www.nhc.noaa.gov/gis/

async function fetchNOAANHC(): Promise<NoaaNhcStorm[]> {
  try {
    // Tenta o feed de tempestades ativas do NHC
    const res = await fetchComTimeout(
      "https://www.nhc.noaa.gov/gtwo.php?basin=atlc&fdays=5&format=geojson",
      10000,
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      features: Array<{
        properties: {
          id: string;
          name: string;
          nature: string;
          intensity: string;
          maxSustainedWind: number;
          movementDesc: string;
          dateTime: string;
        };
        geometry: { coordinates: [number, number] };
      }>;
    };

    if (!data.features) return [];

    return data.features
      .filter((f) => f.properties?.id)
      .map((f) => {
        const cat = f.properties.intensity === "H" ? Math.min(5, Math.max(1, Math.round(f.properties.maxSustainedWind / 25)))
          : f.properties.intensity === "S" ? 2
          : 1;
        return {
          id: f.properties.id,
          nome: f.properties.name || "Tempestade sem nome",
          tipo: f.properties.nature || "Tropical Cyclone",
          intensidade: cat,
          vento_max_kt: f.properties.maxSustainedWind || 0,
          lat: f.geometry.coordinates[1] || 0,
          lon: f.geometry.coordinates[0] || 0,
          timestamp: new Date(f.properties.dateTime || Date.now()).getTime(),
          movimento: f.properties.movementDesc || "",
        };
      });
  } catch {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════
//  APIs QUE REQUEREM CADASTRO GRATUITO
// ═════════════════════════════════════════════════════════════════════
//
// As APIs abaixo precisam de chave gratuita obtida via cadastro.
// Instruções:
//   - OpenWeatherMap: https://home.openweathermap.org/users/sign_up (Free: 1.000 chamadas/dia)
//   - WeatherAPI.com: https://www.weatherapi.com/signup.aspx (Free: 1.000.000 chamadas/mês)
//   - NASA FIRMS:     https://firms.modaps.eosdis.nasa.gov/api/map_key/ (Free, apenas e-mail)
//
// Cole a chave nas variáveis abaixo ou nas env vars do projeto.

// Configure via env var VITE_OWM_KEY na aba Keys/API keys
const OWM_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_OWM_KEY"] || null;

// Configure via env var VITE_WEATHERAPI_KEY na aba Keys/API keys
const WEATHERAPI_KEY = (import.meta.env as Record<string, string | undefined>)["VITE_WEATHERAPI_KEY"] || null;

// ── OpenWeatherMap (precipitação/ clima) ───────────────────────────

async function fetchOWM(lat: number, lon: number): Promise<OWMData | null> {
  if (!OWM_KEY) return null;
  try {
    const res = await fetchComTimeout(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=pt_br`,
      8000,
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      main: { temp: number; humidity: number };
      weather: Array<{ id: number; description: string }>;
      wind: { speed: number };
      rain?: { "1h": number; "3h"?: number };
    };

    return {
      temperatura_c: data.main?.temp ?? null,
      precipitacao_mm: data.rain?.["1h"] ?? data.rain?.["3h"] ?? null,
      codigo_tempo: data.weather?.[0]?.id ?? null,
      vento_kmh: data.wind?.speed ? Math.round(data.wind.speed * 3.6) : null,
      umidade: data.main?.humidity ?? null,
    };
  } catch {
    return null;
  }
}

// ── WeatherAPI.com (precipitação/ clima) ────────────────────────────

async function fetchWeatherAPI(lat: number, lon: number): Promise<WeatherApiData | null> {
  if (!WEATHERAPI_KEY) return null;
  try {
    const res = await fetchComTimeout(
      `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&lang=pt`,
      8000,
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      current: {
        temp_c: number;
        humidity: number;
        cloud: number;
        condition: { code: number; text: string };
        wind_kph: number;
        precip_mm: number;
      };
    };

    if (!data.current) return null;

    return {
      temperatura_c: data.current.temp_c ?? null,
      precipitacao_mm: data.current.precip_mm ?? null,
      codigo_tempo: data.current.condition?.code ?? null,
      vento_kmh: data.current.wind_kph ?? null,
      umidade: data.current.humidity ?? null,
    };
  } catch {
    return null;
  }
}

// ── NWS Tsunami Alerts (NOAA / National Weather Service) ──────────
// API pública gratuita, sem chave. Requer User-Agent personalizado.
// Documentação: https://www.weather.gov/documentation/services-web-api

async function fetchNwsTsunami(): Promise<NwsTsunamiAlert[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(
      "https://api.weather.gov/alerts/active?event=Tsunami",
      {
        headers: {
          "User-Agent": "(SentinelaGlobal, sentinelaglobal.app)",
          "Accept": "application/geo+json",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      features: Array<{
        properties: {
          id: string;
          event: string;
          headline: string;
          description: string;
          instruction: string;
          areas: string;
          severity: string;
          sent: string;
          url: string;
        };
      }>;
    };

    return data.features
      .filter((f) => f.properties?.id)
      .map((f) => {
        const sev = f.properties.severity === "Extreme" ? 5
          : f.properties.severity === "Severe" ? 4
          : f.properties.severity === "Moderate" ? 3
          : 2;
        return {
          id: f.properties.id,
          titulo: f.properties.headline || "Alerta de Tsunami",
          descricao: f.properties.description || "",
          areas_afetadas: f.properties.areas || "Não informado",
          severidade: sev,
          timestamp: f.properties.sent || new Date().toISOString(),
          url: f.properties.url || "https://www.tsunami.gov",
        };
      });
  } catch {
    return [];
  }
}

// ── INMET — Dados de Estações Meteorológicas ───────────────────────
// API pública: https://apitempo.inmet.gov.br/estacoes/T
// Dados da estação: /estacao/{data}/{data}/{codigo}

interface InmetStation {
  CD_ESTACAO: string;
  DC_NOME: string;
  VL_LATITUDE: string;
  VL_LONGITUDE: string;
  SG_ESTADO: string;
  CD_SITUACAO: string;
  TP_ESTACAO: string;
}

/** Cache de estações INMET (atualiza a cada 6h) */
let cacheEstacoesInmet: { estacoes: InmetStation[]; timestamp: number } | null = null;
const TEMPO_CACHE_ESTACOES_MS = 6 * 60 * 60 * 1000;

async function fetchEstacoesINMET(): Promise<InmetStation[]> {
  if (cacheEstacoesInmet && Date.now() - cacheEstacoesInmet.timestamp < TEMPO_CACHE_ESTACOES_MS) {
    return cacheEstacoesInmet.estacoes;
  }
  try {
    const res = await fetchComTimeout(
      "https://apitempo.inmet.gov.br/estacoes/T",
      10000,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as InmetStation[];
    if (!Array.isArray(data)) return [];

    // Filtra apenas estações automáticas operantes
    const operantes = data.filter((s) => s.CD_SITUACAO === "Operante" && s.TP_ESTACAO === "Automatica");
    cacheEstacoesInmet = { estacoes: operantes, timestamp: Date.now() };
    return operantes;
  } catch {
    return [];
  }
}

/**
 * Busca dados de precipitação do INMET para a localização mais próxima.
 * Encontra a estação automática mais próxima e tenta obter dados.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Cache de dados de precipitação INMET (10 min) */
let cachePrecipInmet: { mm: number | null; timestamp: number } | null = null;
const TEMPO_CACHE_PRECIP_INMET_MS = 10 * 60 * 1000;

async function fetchINMETPrecip(lat: number, lon: number): Promise<number | null> {
  // Tenta cache
  if (cachePrecipInmet && Date.now() - cachePrecipInmet.timestamp < TEMPO_CACHE_PRECIP_INMET_MS) {
    return cachePrecipInmet.mm;
  }

  try {
    const estacoes = await fetchEstacoesINMET();
    if (estacoes.length === 0) return null;

    // Encontra a estação mais próxima
    let menorDist = Infinity;
    let estacaoProxima: InmetStation | null = null;

    for (const est of estacoes) {
      const eLat = parseFloat(est.VL_LATITUDE);
      const eLon = parseFloat(est.VL_LONGITUDE);
      if (isNaN(eLat) || isNaN(eLon)) continue;

      const dist = haversineKm(lat, lon, eLat, eLon);
      if (dist < menorDist) {
        menorDist = dist;
        estacaoProxima = est;
      }
    }

    if (!estacaoProxima || menorDist > 300) return null; // Só usa se estiver a até 300km

    // Tenta obter dados da estação via endpoint de dados
    const hoje = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const res = await fetchComTimeout(
      `https://apitempo.inmet.gov.br/estacao/${hoje}/${hoje}/${estacaoProxima.CD_ESTACAO}`,
      8000,
    );

    if (res.ok) {
      const texto = await res.text();
      if (texto && texto.trim().length > 0) {
        try {
          const dados = JSON.parse(texto) as Array<{ chuva?: number; precip?: number; precipitacao?: number }>;
          if (Array.isArray(dados) && dados.length > 0) {
            const ultimo = dados[dados.length - 1];
            const mm = ultimo.chuva ?? ultimo.precip ?? ultimo.precipitacao ?? null;
            if (mm !== null) {
              cachePrecipInmet = { mm, timestamp: Date.now() };
              return mm;
            }
          }
        } catch {
          // Parse falhou, tenta formato alternativo
        }
      }
    }

    /* Endpoint /dados/ removido — retorna 404 na API INMET */

    return null;
  } catch {
    return null;
  }
}

// ── Open-Meteo ──────────────────────────────────────────────────────

async function fetchOpenMeteo(lat: number, lon: number): Promise<OpenMeteoData | null> {
  try {
    const res = await fetchComTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,precipitation,weather_code,wind_speed_10m" +
      "&hourly=precipitation,precipitation_probability,weather_code" +
      "&daily=precipitation_sum,precipitation_probability_max,weather_code" +
      "&past_days=1&forecast_days=1&timezone=auto",
      8000,
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      current?: {
        temperature_2m: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      hourly?: {
        time: string[];
        precipitation: number[];
        precipitation_probability: number[];
        weather_code: number[];
      };
      daily?: {
        precipitation_sum: number[];
        precipitation_probability_max: number[];
        weather_code: number[];
      };
    };

    // Extrai dados horários — incluindo a hora atual para acumulado mais preciso
    const agora = Date.now();
    const proximas6h = data.hourly?.time
      ?.map((t, i) => ({ t, i }))
      .filter(({ t }) => new Date(t).getTime() >= agora - 60 * 60 * 1000)
      .slice(0, 6) || [];

    // Precipitação: usa o maior valor entre o current (instantâneo) e a hora atual (acumulado)
    const precipitacaoCurrent = data.current?.precipitation ?? null;
    const precipitacaoHoraAtual = proximas6h.length > 0
      ? (data.hourly?.precipitation[proximas6h[0].i] ?? null)
      : null;
    const precipitacaoFinal = precipitacaoCurrent !== null && precipitacaoHoraAtual !== null
      ? Math.max(precipitacaoCurrent, precipitacaoHoraAtual)
      : (precipitacaoCurrent ?? precipitacaoHoraAtual ?? null);

    // Extrai dados horários das últimas 24h (histórico)
    const ultimas24h = data.hourly?.time
      ?.map((t, i) => ({ t, i }))
      .filter(({ t }) => {
        const time = new Date(t).getTime();
        return time >= agora - 24 * 60 * 60 * 1000 && time <= agora;
      })
      || [];

    return {
      temperatura_c: data.current?.temperature_2m ?? null,
      precipitacao_mm: precipitacaoFinal,
      codigo_tempo: data.current?.weather_code ?? null,
      vento_kmh: data.current?.wind_speed_10m ?? null,
      precipitacao_diaria_mm: data.daily?.precipitation_sum?.[0] ?? null,
      prob_precipitacao_max: data.daily?.precipitation_probability_max?.[0] ?? null,
      codigo_tempo_diario: data.daily?.weather_code?.[0] ?? null,
      // Dados horários para classificação de chuva
      precipitacao_horaria_proximas_6h: proximas6h.map(i => data.hourly?.precipitation[i.i] ?? 0),
      probabilidade_horaria_proximas_6h: proximas6h.map(i => data.hourly?.precipitation_probability[i.i] ?? 0),
      codigos_tempo_horarios: proximas6h.map(i => data.hourly?.weather_code[i.i] ?? 0),
      // Histórico 24h
      precipitacao_horaria_24h: ultimas24h.map(i => data.hourly?.precipitation[i.i] ?? 0),
      probabilidade_horaria_24h: ultimas24h.map(i => data.hourly?.precipitation_probability[i.i] ?? 0),
      codigos_tempo_24h: ultimas24h.map(i => data.hourly?.weather_code[i.i] ?? 0),
      horarios_24h: ultimas24h.map(i => data.hourly?.time[i.i] ?? ""),
    };
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════
//  CONVEX PROXY — Tenta via Convex action (server-side, sem CORS)
// ═════════════════════════════════════════════════════════════════════

let convexClient: import("convex/browser").ConvexHttpClient | null = null;

async function getConvexClient() {
  if (convexClient) return convexClient;
  const url = typeof import.meta !== "undefined"
    ? (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CONVEX_URL
    : undefined;
  if (!url) return null;
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    convexClient = new ConvexHttpClient(url);
  } catch {
    // Convex/browser não disponível
  }
  return convexClient;
}

// ═════════════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL — Busca dados de TODAS as fontes em paralelo
// ═════════════════════════════════════════════════════════════════════

/**
 * Busca dados REAIS de TODAS as APIs de monitoramento de desastres em paralelo.
 *
 * Estratégia multi-camada:
 *   1. Convex Action (server-side, sem CORS) — via ConvexHttpClient
 *   2. Fetch direto do navegador (fallback se Convex falhar)
 *
 * APIs consultadas:
 *   Públicas (sem chave): USGS, GDACS, EMSC, USGS Volcano, OpenFEMA, Copernicus EMS,
 *                         NOAA NHC, Open-Meteo, NWS Tsunami
 *   Com chave gratuita:   NASA FIRMS, OpenWeatherMap, WeatherAPI, INMET
 */
export async function buscarDadosMundiais(
  userLat?: number,
  userLon?: number,
): Promise<DadosMundiais> {
  // ── TENTATIVA 1: Convex Action (server-side, sem CORS) ───────────
  if (userLat !== undefined && userLon !== undefined) {
    try {
      const client = await getConvexClient();
      if (client) {
        const { api } = await import("../convex/_generated/api");
        const resultado = await client.action(api.proxyApi.buscarDadosMundiais, {
          lat: userLat,
          lon: userLon,
        }) as DadosMundiais;
        if (resultado && resultado.fontes && resultado.fontes.length > 0) {
          console.log(
            "%c[SentinelaGlobal] ✅ Dados obtidos via Convex Action (proxy server-side, zero CORS)",
            "background:#1e1b2e;color:#34d399;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px",
            resultado.fontes,
          );
          return resultado;
        }
      }
    } catch (e) {
      console.warn("[SentinelaGlobal] Convex action proxy falhou, usando fetch direto:", e);
    }
  }

  // ── TENTATIVA 2: Fetch direto (fallback) ────────────────────────
  console.log(
    "%c[SentinelaGlobal] ⚠️ Usando fetch direto do navegador (pode haver erros CORS)",
    "background:#1e1b2e;color:#fbbf24;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px"
  );
  const fontesEncontradas: string[] = [];

  const addFonte = (nome: string, temDados: boolean) => {
    if (temDados) fontesEncontradas.push(nome);
  };

  // Dispara TODAS as APIs em paralelo
  const resultados = await Promise.allSettled([
    // APIs sem chave (públicas)
    fetchUSGS().catch(() => [] as ApiEarthquake[]),
    Promise.resolve([] as GdacsDisaster[]), // CORS bloqueado — só via proxy
    Promise.resolve([] as EmscEarthquake[]), // CORS bloqueado — só via proxy
    Promise.resolve([] as UsgsVolcano[]), // CORS bloqueado — só via proxy
    fetchOpenFEMA().catch(() => [] as FemaDisaster[]),
    Promise.resolve([] as CopernicusActivation[]), // CORS bloqueado — só via proxy
    Promise.resolve([] as NoaaNhcStorm[]), // CORS bloqueado — só via proxy
    fetchNwsTsunami().catch(() => [] as NwsTsunamiAlert[]),
    fetchNasaFirms().catch(() => [] as NasaFirmsFire[]),
    // APIs com chave (OWM, WeatherAPI)
    userLat !== undefined && userLon !== undefined
      ? fetchOWM(userLat, userLon).catch(() => null as OWMData | null)
      : Promise.resolve(null as OWMData | null),
    userLat !== undefined && userLon !== undefined
      ? fetchWeatherAPI(userLat, userLon).catch(() => null as WeatherApiData | null)
      : Promise.resolve(null as WeatherApiData | null),
    // Open-Meteo (clima, sem chave)
    userLat !== undefined && userLon !== undefined
      ? fetchOpenMeteo(userLat, userLon).catch(() => null as OpenMeteoData | null)
      : Promise.resolve(null as OpenMeteoData | null),
  ]);

  const getVal = <T>(i: number, padrao: T): T =>
    resultados[i]?.status === "fulfilled" ? (resultados[i] as PromiseFulfilledResult<T>).value : padrao;

  const terremotos = getVal<ApiEarthquake[]>(0, []);
  addFonte("USGS", terremotos.length > 0);

  const desastres_gdacs = getVal<GdacsDisaster[]>(1, []);
  addFonte("GDACS", desastres_gdacs.length > 0);

  const emsc_earthquakes = getVal<EmscEarthquake[]>(2, []);
  addFonte("EMSC", emsc_earthquakes.length > 0);

  const volcanoes = getVal<UsgsVolcano[]>(3, []);
  addFonte("USGS Volcano", volcanoes.length > 0);

  const fema_disasters = getVal<FemaDisaster[]>(4, []);
  addFonte("OpenFEMA", fema_disasters.length > 0);

  const copernicus_activations = getVal<CopernicusActivation[]>(5, []);
  addFonte("Copernicus EMS", copernicus_activations.length > 0);

  const noaa_nhc_storms = getVal<NoaaNhcStorm[]>(6, []);
  addFonte("NOAA NHC", noaa_nhc_storms.length > 0);

  const tsunamis = getVal<NwsTsunamiAlert[]>(7, []);
  addFonte("NOAA Tsunami", tsunamis.length > 0);

  const incendios_nasa = getVal<NasaFirmsFire[]>(8, []);
  addFonte("NASA FIRMS", incendios_nasa.length > 0);

  const owm = getVal<OWMData | null>(9, null);
  addFonte("OpenWeatherMap", owm !== null);

  const weatherapi = getVal<WeatherApiData | null>(10, null);
  addFonte("WeatherAPI", weatherapi !== null);

  const meteo = getVal<OpenMeteoData | null>(11, null);
  addFonte("Open-Meteo", meteo !== null);

  // INMET (precipitação Brasil) — chamada separada porque é síncrona dependente
  let inmet_precip_mm: number | null = null;
  let inmet_estacao: string | null = null;
  if (userLat !== undefined && userLon !== undefined) {
    try {
      inmet_precip_mm = await fetchINMETPrecip(userLat, userLon);
      if (inmet_precip_mm !== null) {
        addFonte("INMET", true);
        inmet_estacao = "Estação INMET";
      }
    } catch { /* INMET falhou — segue sem */ }
  }

  // Cemaden (HTTP, pode falhar por mixed content em HTTPS)
  let cemaden: CemadenEstacao[] = [];
  try {
    cemaden = await fetchCemaden();
    addFonte("Cemaden", cemaden.length > 0);
  } catch { /* Cemaden falhou — segue sem */ }

  const fontes = [...new Set(fontesEncontradas)];

  logDados(`Dados coletados de ${fontes.length} fonte(s)`, {
    fontes,
    terremotos: terremotos.length,
    desastres_gdacs: desastres_gdacs.length,
    incendios_nasa: incendios_nasa.length,
    tsunamis: tsunamis.length,
    emsc: emsc_earthquakes.length,
    volcanoes: volcanoes.length,
    fema: fema_disasters.length,
    copernicus: copernicus_activations.length,
    nhc: noaa_nhc_storms.length,
    meteo: meteo !== null,
    owm: owm !== null,
    weatherapi: weatherapi !== null,
    inmet: inmet_precip_mm !== null,
    cemaden: cemaden.length,
  });

  return {
    terremotos,
    desastres_gdacs,
    cemaden,
    meteo,
    incendios_nasa,
    tsunamis,
    emsc_earthquakes,
    volcanoes,
    fema_disasters,
    copernicus_activations,
    noaa_nhc_storms,
    owm,
    weatherapi,
    inmet_precip_mm,
    inmet_estacao,
    timestamp_coleta: new Date().toISOString(),
    fontes,
  };
}

/** Debug log para dados coletados */

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
      id: `usgs_${eq.id}`,
      tipo: eq.tsunami ? "tsunami" : "terremoto",
      severidade: sev,
      lat: eq.lat,
      lon: eq.lon,
      regiao: cidade,
      pais: pais,
      descricao: `Terremoto magnitude ${eq.magnitude} em ${eq.lugar}. Profundidade: ${eq.profundidade_km.toFixed(0)} km. ${eq.tsunami ? "⚠️ Alerta de tsunami ativo!" : ""}`,
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
      id: `gdacs_${gd.id}`,
      tipo: tipoMap[gd.tipo] || "desastre",
      severidade: sev,
      lat: gd.lat,
      lon: gd.lon,
      regiao: gd.titulo,
      pais: gd.titulo,
      descricao: gd.resumo || `${gd.tipo_nome}: ${gd.titulo}`,
      fonte: "GDACS",
      timestamp: gd.timestamp,
    });
  }

  // Cemaden
  for (const c of dados.cemaden) {
    if (c.chuva_mm !== null && c.lat && c.lon) {
      eventos.push({
        id: `cemaden_${c.codigo}`,
        tipo: "enchente",
        severidade: c.chuva_mm > 50 ? 4 : c.chuva_mm > 30 ? 3 : 2,
        lat: c.lat || -8.05,
        lon: c.lon || -34.88,
        regiao: c.nome,
        pais: "Brasil",
        descricao: `Estação ${c.nome} registrou ${c.chuva_mm.toFixed(1)}mm de chuva. Risco de alagamento.`,
        fonte: "Cemaden",
        timestamp: new Date(c.data_hora).getTime(),
      });
    }
  }

  // NASA FIRMS → Queimadas ativas
  for (const f of dados.incendios_nasa) {
    const sev = f.confianca === "high" ? 4 : f.confianca === "nominal" ? 3 : 2;
    eventos.push({
      id: `firms_${f.id}`,
      tipo: "queimada",
      severidade: sev,
      lat: f.latitude,
      lon: f.longitude,
      regiao: f.pais,
      pais: f.pais,
      descricao: `🔥 Queimada ativa — brilho ${f.brilho}K, FRP ${f.frp.toFixed(1)} MW, confiança ${f.confianca}.`,
      fonte: "NASA FIRMS",
      timestamp: new Date(f.data_hora).getTime(),
    });
  }

  // NOAA/NWS → Alertas de tsunami
  for (const ts of dados.tsunamis) {
    eventos.push({
      id: `noaa_tsunami_${ts.id}`,
      tipo: "tsunami",
      severidade: ts.severidade,
      lat: 0,
      lon: 0,
      regiao: ts.areas_afetadas,
      pais: ts.areas_afetadas.split(",")[0]?.trim() || "Oceano Pacífico",
      descricao: `🌊 Alerta de Tsunami: ${ts.titulo}. ${ts.descricao.slice(0, 300)}`,
      fonte: "NOAA Tsunami",
      timestamp: new Date(ts.timestamp).getTime(),
    });
  }

  // EMSC → Earthquakes
  for (const eq of dados.emsc_earthquakes) {
    const sev = Math.min(5, Math.max(1, Math.round(eq.magnitude / 1.5)));
    eventos.push({
      id: `emsc_${eq.id}`,
      tipo: eq.tsunami ? "tsunami" : "terremoto",
      severidade: sev,
      lat: eq.lat,
      lon: eq.lon,
      regiao: eq.lugar.split(",").pop()?.trim() || eq.lugar,
      pais: extrairPais(eq.lugar),
      descricao: `Terremoto magnitude ${eq.magnitude} (EMSC) em ${eq.lugar}. Profundidade: ${eq.profundidade_km.toFixed(0)} km.`,
      fonte: "EMSC",
      timestamp: eq.timestamp,
    });
  }

  return eventos;
}

function logDados(tag: string, data: unknown) {
  console.log(
    "%c[SentinelaGlobal Dados] " + tag,
    "background:#1e1b2e;color:#67e8f9;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:12px",
    data,
  );
}

// ═════════════════════════════════════════════════════════════════════
//  HELPERS PÚBLICOS
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

/**
 * Converte dados reais para o formato Evento (compatível com o cálculo de risco local).
 */
export 

function extrairPais(texto: string): string {
  const paises: Record<string, string> = {
    "Brazil": "Brasil", "Philippines": "Filipinas", "Indonesia": "Indonésia",
    "Japan": "Japão", "Mexico": "México", "Chile": "Chile", "Peru": "Peru",
    "Turkey": "Turquia", "Iran": "Irã", "India": "Índia", "China": "China",
    "Russia": "Rússia", "USA": "EUA", "Alaska": "EUA", "California": "EUA",
    "Hawaii": "EUA", "Italy": "Itália", "Greece": "Grécia", "Iceland": "Islândia",
    "New Zealand": "Nova Zelândia", "Papua": "Papua Nova Guiné",
    "Fiji": "Fiji", "Tonga": "Tonga", "Vanuatu": "Vanuatu",
    "Taiwan": "Taiwan", "Afghanistan": "Afeganistão", "Pakistan": "Paquistão",
    "Nepal": "Nepal", "Myanmar": "Myanmar", "Argentina": "Argentina",
    "Colombia": "Colômbia", "Ecuador": "Equador", "Costa Rica": "Costa Rica",
    "Guatemala": "Guatemala", "El Salvador": "El Salvador",
    "Algeria": "Argélia", "Morocco": "Marrocos", "Mozambique": "Moçambique",
    "Madagascar": "Madagascar", "South Africa": "África do Sul",
    "Kenya": "Quênia", "Ethiopia": "Etiópia", "Somalia": "Somália",
    "Australia": "Austrália", "Vietnam": "Vietnã", "Thailand": "Tailândia",
    "Canada": "Canadá", "Germany": "Alemanha", "France": "França",
    "United Kingdom": "Reino Unido", "Spain": "Espanha", "Portugal": "Portugal",
    "Netherlands": "Países Baixos", "Switzerland": "Suíça", "Sweden": "Suécia",
    "Norway": "Noruega", "Denmark": "Dinamarca", "Finland": "Finlândia",
    "Poland": "Polônia", "Ukraine": "Ucrânia", "Romania": "Romênia",
    "Czech": "República Tcheca", "Hungary": "Hungria", "Austria": "Áustria",
    "Ireland": "Irlanda", "Belgium": "Bélgica", "Bulgaria": "Bulgária",
    "Croatia": "Croácia", "Serbia": "Sérvia",
    "South Korea": "Coreia do Sul", "North Korea": "Coreia do Norte",
    "Malaysia": "Malásia", "Singapore": "Cingapura", "Bangladesh": "Bangladesh",
    "Sri Lanka": "Sri Lanka", "Mongolia": "Mongólia", "Kazakhstan": "Cazaquistão",
    "Uzbekistan": "Uzbequistão", "Turkmenistan": "Turcomenistão",
    "Saudi Arabia": "Arábia Saudita", "United Arab Emirates": "Emirados Árabes",
    "Israel": "Israel", "Jordan": "Jordânia", "Lebanon": "Líbano",
    "Egypt": "Egito", "Libya": "Líbia", "Tunisia": "Tunísia",
    "Sudan": "Sudão", "Nigeria": "Nigéria", "Ghana": "Gana",
    "Angola": "Angola", "Congo": "Congo", "Zimbabwe": "Zimbábue",
    "Tanzania": "Tanzânia", "Uganda": "Uganda", "Cameroon": "Camarões",
    "Ivory Coast": "Costa do Marfim", "Senegal": "Senegal", "Mali": "Mali",
    "Bolivia": "Bolívia", "Paraguay": "Paraguai", "Uruguay": "Uruguai",
    "Venezuela": "Venezuela", "Panama": "Panamá", "Cuba": "Cuba",
    "Haiti": "Haiti", "Dominican": "República Dominicana",
    "Jamaica": "Jamaica", "Puerto Rico": "Porto Rico",
  };
  for (const [en, pt] of Object.entries(paises)) {
    if (texto.includes(en)) return pt;
  }
  // Tenta extrair via última parte após vírgula
  const partes = texto.split(",").map((s) => s.trim());
  const ultima = partes[partes.length - 1] || texto;
  if (ultima === texto || /^-?\d+\.\d+$/.test(ultima) || ultima === "world") {
    return "Região remota";
  }
  return ultima;
}

/**
 * Retorna descrição do código WMO de tempo.
 */
export function descreverCodigoTempo(codigo: number | null): string {
  if (codigo === null) return "Indisponível";
  const entry = WMO_CODIGOS[codigo];
  return entry ? entry.nome : `Código ${codigo}`;
}

/**
 * Retorna se o código WMO indica tempo severo.
 */
export function isTempoSevero(codigo: number | null): boolean {
  if (codigo === null) return false;
  return WMO_CODIGOS[codigo]?.severo ?? false;



}