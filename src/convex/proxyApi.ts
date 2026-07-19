"use node";

/**
 * src/convex/proxyApi.ts
 *
 * Proxy de APIs externas via Convex Action (server-side).
 * O frontend chama esta ação em vez de fazer fetch direto das APIs externas,
 * eliminando TODOS os erros de CORS.
 *
 * Como configurar as chaves de API:
 *   1. Acesse a aba "Keys" / "API keys" do projeto Freebuff
 *   2. Adicione as seguintes variáveis (sem o prefixo VITE_):
 *      - OWM_KEY           → sua chave OpenWeatherMap (free: https://home.openweathermap.org/users/sign_up)
 *      - WEATHERAPI_KEY    → sua chave WeatherAPI (free: https://www.weatherapi.com/signup.aspx)
 *      - NASA_FIRMS_KEY    → sua MAP_KEY gratuita (free: https://firms.modaps.eosdis.nasa.gov/api/map_key/)
 *      - GROQ_API_KEY      → sua chave Groq Cloud (opcional, usada pelo LLM)
 *   3. Se não configurar, o proxy usa as chaves padrão (que podem estar em rate-limit)
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

// ═════════════════════════════════════════════════════════════════════
//  TIPOS DE RETORNO (cópia do api-mundiais.ts para não depender de imports)
// ═════════════════════════════════════════════════════════════════════

interface ProxyEarthquake {
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

interface ProxyDisaster {
  id: string;
  tipo: string;
  tipo_nome: string;
  alerta: string;
  titulo: string;
  resumo: string;
  lat: number;
  lon: number;
  timestamp: number;
  url: string;
}

interface ProxyStation {
  nome: string;
  codigo: string;
  data_hora: string;
  chuva_mm: number | null;
  lat: number | null;
  lon: number | null;
}

interface ProxyMeteo {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  precipitacao_diaria_mm: number | null;
  prob_precipitacao_max: number | null;
  codigo_tempo_diario: number | null;
  precipitacao_horaria_proximas_6h: number[];
  probabilidade_horaria_proximas_6h: number[];
  codigos_tempo_horarios: number[];
  precipitacao_horaria_24h: number[];
  probabilidade_horaria_24h: number[];
  codigos_tempo_24h: number[];
  horarios_24h: string[];
}

interface ProxyFire {
  id: string;
  latitude: number;
  longitude: number;
  brilho: number;
  confianca: string;
  frp: number;
  data_hora: string;
  pais: string;
}

interface ProxyTsunami {
  id: string;
  titulo: string;
  descricao: string;
  areas_afetadas: string;
  severidade: number;
  timestamp: string;
  url: string;
}

interface ProxyEmsc {
  id: string;
  magnitude: number;
  lugar: string;
  timestamp: number;
  lat: number;
  lon: number;
  profundidade_km: number;
  tsunami: boolean;
}

interface ProxyVolcano {
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

interface ProxyFema {
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

interface ProxyCopernicus {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  pais: string;
  lat: number;
  lon: number;
  severidade: number;
  timestamp: number;
}

interface ProxyNhc {
  id: string;
  nome: string;
  tipo: string;
  intensidade: number;
  vento_max_kt: number;
  lat: number;
  lon: number;
  timestamp: number;
  movimento: string;
}

interface ProxyOwm {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  umidade: number | null;
}

interface ProxyWeatherApi {
  temperatura_c: number | null;
  precipitacao_mm: number | null;
  codigo_tempo: number | null;
  vento_kmh: number | null;
  umidade: number | null;
}

interface ProxyResult {
  terremotos: ProxyEarthquake[];
  desastres_gdacs: ProxyDisaster[];
  cemaden: ProxyStation[];
  meteo: ProxyMeteo | null;
  incendios_nasa: ProxyFire[];
  tsunamis: ProxyTsunami[];
  emsc_earthquakes: ProxyEmsc[];
  volcanoes: ProxyVolcano[];
  fema_disasters: ProxyFema[];
  copernicus_activations: ProxyCopernicus[];
  noaa_nhc_storms: ProxyNhc[];
  owm: ProxyOwm | null;
  weatherapi: ProxyWeatherApi | null;
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

// ═════════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════════

async function fetchJSON(url: string, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    throw e;
  } finally {
    clearTimeout(id);
  }
}

async function fetchText(url: string, headers?: Record<string, string>, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    throw e;
  } finally {
    clearTimeout(id);
  }
}

// ═════════════════════════════════════════════════════════════════════
//  FETCH FUNCTIONS
// ═════════════════════════════════════════════════════════════════════

async function fetchUSGS(): Promise<ProxyEarthquake[]> {
  try {
    const data = await fetchJSON(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
      8000,
    ) as { features: Array<{ id: string; properties: { mag: number; place: string; time: number; tsunami: number; alert: string | null; mmi: number | null }; geometry: { coordinates: [number, number, number] } }> };
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
  } catch { return []; }
}

async function fetchGDACS(): Promise<ProxyDisaster[]> {
  try {
    const data = await fetchJSON(
      "https://www.gdacs.org/contentdata/xml/gdacs.geojson",
      10000,
    ) as { features: Array<{ id: string; properties: { eventtype: string; alertlevel: string; alertscore: number; name: string; description: string; fromdate: number; url: string }; geometry: { coordinates: [number, number] } }> };
    const tipos = ["EQ", "TC", "FL", "WF", "VO", "DR"];
    return data.features
      .filter((f) => tipos.includes(f.properties.eventtype))
      .map((f) => ({
        id: f.id,
        tipo: f.properties.eventtype,
        tipo_nome: GDACS_TIPO_NOME[f.properties.eventtype] || f.properties.eventtype,
        alerta: f.properties.alertlevel,
        titulo: f.properties.name || "Desastre sem nome",
        resumo: f.properties.description || "",
        lat: f.geometry.coordinates[1] || 0,
        lon: f.geometry.coordinates[0] || 0,
        timestamp: f.properties.fromdate,
        url: f.properties.url || "",
      }));
  } catch { return []; }
}

async function fetchEMSC(): Promise<ProxyEmsc[]> {
  try {
    const data = await fetchJSON(
      "https://www.seismicportal.eu/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=20",
      8000,
    ) as { features: Array<{ id: string; properties: { mag: number; flynn_region: string; time: number; depth: number }; geometry: { coordinates: [number, number, number] } }> };
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
  } catch { return []; }
}

async function fetchVolcanoes(): Promise<ProxyVolcano[]> {
  try {
    const data = await fetchJSON(
      "https://volcanoes.usgs.gov/hans-public/api/volcano/list",
      10000,
    ) as Array<{ id: number; name: string; status: string; description: string; latitude: number; longitude: number; country: string; lastEruptionDate: string }>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((v) => v.latitude && v.longitude && v.status)
      .slice(0, 20)
      .map((v) => {
        const sev = v.status === "Erupting" ? 5 : v.status === "Unrest" ? 3 : v.status === "Watch" ? 4 : 2;
        return {
          id: String(v.id),
          nome: v.name || "Vulcão sem nome",
          status: v.status || "Normal",
          descricao: v.description?.slice(0, 200) || v.status,
          lat: v.latitude,
          lon: v.longitude,
          pais: v.country || "Desconhecido",
          severidade: sev,
          timestamp: v.lastEruptionDate ? new Date(v.lastEruptionDate).getTime() : Date.now(),
        };
      });
  } catch { return []; }
}

async function fetchFEMA(): Promise<ProxyFema[]> {
  try {
    const data = await fetchJSON(
      "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?" +
      "$filter=incidentType%20eq%20%27Fire%27%20or%20incidentType%20eq%20%27Hurricane%27%20or%20" +
      "incidentType%20eq%20%27Earthquake%27%20or%20incidentType%20eq%20%27Flood%27%20or%20" +
      "incidentType%20eq%20%27Severe%20Storm%27&$orderby=incidentBeginDate%20desc&$top=15",
      10000,
    ) as { DisasterDeclarationsSummaries: Array<{ id: number; incidentType: string; declarationTitle: string; incidentBeginDate: string; state: string }> };
    if (!data.DisasterDeclarationsSummaries) return [];
    const estadoLatLon: Record<string, [number, number]> = {
      CA: [36.8, -119.8], FL: [27.8, -81.5], TX: [31.5, -99.3],
      LA: [31.0, -92.4], AL: [32.8, -86.8], MS: [32.7, -89.4],
      GA: [32.6, -83.4], NC: [35.5, -79.4], SC: [33.9, -81.2],
      OK: [35.6, -97.5], CO: [39.0, -105.5], OR: [44.0, -120.5],
      WA: [47.5, -120.5], MT: [47.0, -110.0], AZ: [34.0, -112.0],
      NM: [34.5, -106.0], NV: [39.5, -116.5], UT: [39.5, -111.5],
      NY: [42.8, -75.5], PA: [41.2, -77.2], OH: [40.3, -82.8],
      HI: [21.3, -157.8], AK: [64.0, -150.0], PR: [18.2, -66.6],
    };
    const tipoMap: Record<string, string> = {
      Fire: "incêndio", Hurricane: "furacão", Earthquake: "terremoto",
      Flood: "enchente", "Severe Storm": "tempestade",
    };
    return data.DisasterDeclarationsSummaries.map((d) => {
      const tipo = tipoMap[d.incidentType] || "desastre";
      const sev = d.incidentType === "Hurricane" || d.incidentType === "Earthquake" ? 4 : d.incidentType === "Fire" ? 3 : 2;
      const coords = estadoLatLon[d.state] || [38.0, -98.0];
      return {
        id: String(d.id),
        tipo,
        tipo_nome: d.incidentType,
        titulo: d.declarationTitle || `${d.incidentType} em ${d.state}`,
        descricao: `Desastre ${d.incidentType} declarado em ${d.state} — ${d.declarationTitle || "Emergência"}.`,
        severidade: sev,
        lat: coords[0], lon: coords[1],
        area: d.state,
        timestamp: new Date(d.incidentBeginDate).getTime(),
      };
    });
  } catch { return []; }
}

async function fetchCopernicus(): Promise<ProxyCopernicus[]> {
  try {
    const data = await fetchJSON(
      "https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=20&ordering=-published",
      10000,
    ) as Array<{ id: number; name: string; description: string; country: string; latitude: number; longitude: number; event_type: string; published: string }>;
    if (!Array.isArray(data)) return [];
    const tipoMap: Record<string, string> = {
      WF: "incêndio", FF: "enchente", ST: "tempestade",
      EQ: "terremoto", VO: "vulcão", DR: "seca",
      IND: "incêndio", FL: "enchente",
    };
    return data
      .filter((a) => a.latitude && a.longitude)
      .slice(0, 15)
      .map((a) => {
        const tipo = tipoMap[a.event_type] || "desastre";
        const sev = a.event_type === "WF" || a.event_type === "IND" ? 4 : a.event_type === "FF" || a.event_type === "FL" ? 3 : 2;
        return {
          id: `copernicus_${a.id}`,
          tipo,
          titulo: a.name || `Ativação ${a.id}`,
          descricao: a.description?.slice(0, 200) || `Evento ${a.event_type} em ${a.country}`,
          pais: a.country || "Desconhecido",
          lat: a.latitude, lon: a.longitude,
          severidade: sev,
          timestamp: new Date(a.published).getTime(),
        };
      });
  } catch { return []; }
}

async function fetchNOAANHC(): Promise<ProxyNhc[]> {
  try {
    const data = await fetchJSON(
      "https://www.nhc.noaa.gov/gtwo.php?basin=atlc&fdays=5&format=geojson",
      10000,
    ) as { features: Array<{ properties: { id: string; name: string; nature: string; intensity: string; maxSustainedWind: number; movementDesc: string; dateTime: string }; geometry: { coordinates: [number, number] } }> };
    if (!data.features) return [];
    return data.features
      .filter((f) => f.properties?.id)
      .map((f) => {
        const cat = f.properties.intensity === "H" ? Math.min(5, Math.max(1, Math.round(f.properties.maxSustainedWind / 25))) : f.properties.intensity === "S" ? 2 : 1;
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
  } catch { return []; }
}

async function fetchNwsTsunami(): Promise<ProxyTsunami[]> {
  try {
    const data = await fetch(
      "https://api.weather.gov/alerts/active?event=Tsunami",
      {
        headers: { "User-Agent": "(SentinelaGlobal, sentinelaglobal.app)", Accept: "application/geo+json" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!data.ok) return [];
    const json = await data.json() as { features: Array<{ properties: { id: string; headline: string; description: string; areas: string; severity: string; sent: string; url: string } }> };
    return json.features
      .filter((f) => f.properties?.id)
      .slice(0, 10)
      .map((f) => {
        const sev = f.properties.severity === "Extreme" ? 5 : f.properties.severity === "Severe" ? 4 : f.properties.severity === "Moderate" ? 3 : 2;
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
  } catch { return []; }
}

async function fetchOWMProxy(lat: number, lon: number): Promise<ProxyOwm | null> {
  const key = process.env.OWM_KEY || "1c149418dc7b79a7b9c750102411bae6";
  if (!key) return null;
  try {
    const data = await fetchJSON(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=pt_br`,
      8000,
    ) as { main: { temp: number; humidity: number }; weather: Array<{ id: number }>; wind: { speed: number }; rain?: { "1h"?: number; "3h"?: number } };
    if (!data.main) return null;
    return {
      temperatura_c: data.main.temp,
      precipitacao_mm: data.rain?.["1h"] ?? data.rain?.["3h"] ?? null,
      codigo_tempo: data.weather?.[0]?.id ?? null,
      vento_kmh: data.wind?.speed ? Math.round(data.wind.speed * 3.6) : null,
      umidade: data.main.humidity,
    };
  } catch { return null; }
}

async function fetchWeatherAPIProxy(lat: number, lon: number): Promise<ProxyWeatherApi | null> {
  const key = process.env.WEATHERAPI_KEY || "1b3f114f1469443788c133450260507";
  if (!key) return null;
  try {
    const data = await fetchJSON(
      `https://api.weatherapi.com/v1/current.json?key=${key}&q=${lat},${lon}&lang=pt`,
      8000,
    ) as { current: { temp_c: number; humidity: number; condition: { code: number }; wind_kph: number; precip_mm: number } };
    if (!data.current) return null;
    return {
      temperatura_c: data.current.temp_c,
      precipitacao_mm: data.current.precip_mm,
      codigo_tempo: data.current.condition?.code,
      vento_kmh: data.current.wind_kph,
      umidade: data.current.humidity,
    };
  } catch { return null; }
}

async function fetchOpenMeteoProxy(lat: number, lon: number): Promise<ProxyMeteo | null> {
  try {
    const data = await fetchJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,precipitation,weather_code,wind_speed_10m" +
      "&hourly=precipitation,precipitation_probability,weather_code" +
      "&daily=precipitation_sum,precipitation_probability_max,weather_code" +
      "&past_days=1&forecast_days=1&timezone=auto",
      8000,
    ) as {
      current?: { temperature_2m: number; precipitation: number; weather_code: number; wind_speed_10m: number };
      hourly?: { time: string[]; precipitation: number[]; precipitation_probability: number[]; weather_code: number[] };
      daily?: { precipitation_sum: number[]; precipitation_probability_max: number[]; weather_code: number[] };
    };
    if (!data.current && !data.hourly) return null;
    const agora = Date.now();
    const proximas6h = data.hourly?.time
      ?.map((t, i) => ({ t, i }))
      .filter(({ t }) => new Date(t).getTime() >= agora - 60 * 60 * 1000)
      .slice(0, 6) || [];
    const precipitacaoCurrent = data.current?.precipitation ?? null;
    const precipitacaoHoraAtual = proximas6h.length > 0 ? (data.hourly?.precipitation[proximas6h[0].i] ?? null) : null;
    const precipitacaoFinal = precipitacaoCurrent !== null && precipitacaoHoraAtual !== null
      ? Math.max(precipitacaoCurrent, precipitacaoHoraAtual)
      : (precipitacaoCurrent ?? precipitacaoHoraAtual ?? null);
    const ultimas24h = data.hourly?.time
      ?.map((t, i) => ({ t, i }))
      .filter(({ t }) => { const time = new Date(t).getTime(); return time >= agora - 24 * 60 * 60 * 1000 && time <= agora; })
      || [];
    return {
      temperatura_c: data.current?.temperature_2m ?? null,
      precipitacao_mm: precipitacaoFinal,
      codigo_tempo: data.current?.weather_code ?? null,
      vento_kmh: data.current?.wind_speed_10m ?? null,
      precipitacao_diaria_mm: data.daily?.precipitation_sum?.[0] ?? null,
      prob_precipitacao_max: data.daily?.precipitation_probability_max?.[0] ?? null,
      codigo_tempo_diario: data.daily?.weather_code?.[0] ?? null,
      precipitacao_horaria_proximas_6h: proximas6h.map(i => data.hourly?.precipitation[i.i] ?? 0),
      probabilidade_horaria_proximas_6h: proximas6h.map(i => data.hourly?.precipitation_probability[i.i] ?? 0),
      codigos_tempo_horarios: proximas6h.map(i => data.hourly?.weather_code[i.i] ?? 0),
      precipitacao_horaria_24h: ultimas24h.map(i => data.hourly?.precipitation[i.i] ?? 0),
      probabilidade_horaria_24h: ultimas24h.map(i => data.hourly?.precipitation_probability[i.i] ?? 0),
      codigos_tempo_24h: ultimas24h.map(i => data.hourly?.weather_code[i.i] ?? 0),
      horarios_24h: ultimas24h.map(i => data.hourly?.time[i.i] ?? ""),
    };
  } catch { return null; }
}

async function fetchNASAProxy(): Promise<ProxyFire[]> {
  const key = process.env.NASA_FIRMS_KEY || "8108a779bdb5b1c15fbfbd9fb66070e5";
  if (!key) return [];
  try {
    const csv = await fetchText(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`,
      undefined, 10000,
    );
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
        pais: extrairPaisProxy(`${cols[latIdx]},${cols[lonIdx]}`),
      };
    });
  } catch { return []; }
}

async function fetchINMETProxy(lat: number, lon: number): Promise<{ mm: number | null; estacao: string | null }> {
  try {
    const estacoes = await fetchJSON("https://apitempo.inmet.gov.br/estacoes/T", 10000) as Array<{ CD_ESTACAO: string; VL_LATITUDE: string; VL_LONGITUDE: string; CD_SITUACAO: string; TP_ESTACAO: string; DC_NOME: string }>;
    if (!Array.isArray(estacoes)) return { mm: null, estacao: null };
    const operantes = estacoes.filter((s) => s.CD_SITUACAO === "Operante" && s.TP_ESTACAO === "Automatica");
    if (operantes.length === 0) return { mm: null, estacao: null };
    let menorDist = Infinity;
    let estacaoProx: typeof operantes[0] | null = null;
    for (const est of operantes) {
      const eLat = parseFloat(est.VL_LATITUDE);
      const eLon = parseFloat(est.VL_LONGITUDE);
      if (isNaN(eLat) || isNaN(eLon)) continue;
      const dist = haversineKmProxy(lat, lon, eLat, eLon);
      if (dist < menorDist) { menorDist = dist; estacaoProx = est; }
    }
    if (!estacaoProx || menorDist > 300) return { mm: null, estacao: null };
    const hoje = new Date().toISOString().split("T")[0];
    try {
      const texto = await fetchText(`https://apitempo.inmet.gov.br/estacao/${hoje}/${hoje}/${estacaoProx.CD_ESTACAO}`, undefined, 8000);
      if (texto && texto.trim().length > 0) {
        const dados = JSON.parse(texto) as Array<{ chuva?: number; precip?: number; precipitacao?: number }>;
        if (Array.isArray(dados) && dados.length > 0) {
          const ultimo = dados[dados.length - 1];
          const mm = ultimo.chuva ?? ultimo.precip ?? ultimo.precipitacao ?? null;
          if (mm !== null) return { mm, estacao: estacaoProx.DC_NOME };
        }
      }
    } catch { /* try alternative endpoint */ }
    /* Endpoint /dados/ removido — retorna 404 na API INMET */
    return { mm: null, estacao: null };
  } catch { return { mm: null, estacao: null }; }
}

function haversineKmProxy(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extrairPaisProxy(texto: string): string {
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
    "Kenya": "Quênia", "Ethiopia": "Etiópia", "Taiwan": "Taiwan",
    "South Korea": "Coreia do Sul", "Thailand": "Tailândia", "Vietnam": "Vietnã",
    "Pakistan": "Paquistão", "Bangladesh": "Bangladesh", "Nepal": "Nepal",
    "Afghanistan": "Afeganistão", "Iraq": "Iraque",
    "Saudi Arabia": "Arábia Saudita", "Israel": "Israel", "Jordan": "Jordânia",
  };
  for (const [en, pt] of Object.entries(paises)) {
    if (texto.includes(en)) return pt;
  }
  const partes = texto.split(",").map((s) => s.trim());
  const ultima = partes[partes.length - 1] || texto;
  if (ultima === texto || /^-?\d+\.\d+$/.test(ultima) || ultima === "world") return "Região remota";
  return ultima;
}

// ═════════════════════════════════════════════════════════════════════
//  GROQ ACTION — Análise LLM (server-side, sem expor chave no browser)
// ═════════════════════════════════════════════════════════════════════

/**
 * grokAction — Convex Action que chama a API Groq server-side.
 * A chave GROQ_API_KEY é lida de process.env (configurada no Freebuff Keys panel)
 * e NUNCA é exposta ao navegador.
 *
 * O frontend chama esta ação via ConvexHttpClient, eliminando
 * o vazamento da chave no bundle JavaScript.
 */
export const grokAction = action({
  args: {
    systemPrompt: v.string(),
    userPrompt: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return { success: false, error: "GROQ_API_KEY não configurada no servidor" };
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: args.systemPrompt },
            { role: "user", content: args.userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Groq HTTP ${response.status}: ${text}` };
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, error: "Groq retornou resposta vazia" };
      }

      const parsed = JSON.parse(content) as Record<string, unknown>;
      return { success: true, data: parsed };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});

// ═════════════════════════════════════════════════════════════════════
//  CONVEX ACTION — Proxy de APIs
// ═════════════════════════════════════════════════════════════════════

/**
 * buscarDadosMundiais — Convex Action que busca dados de TODAS as APIs
 * externas de monitoramento de desastres (server-side, sem CORS).
 *
 * O frontend chama esta ação via ConvexHttpClient, eliminando todos os
 * erros de CORS que ocorrem ao chamar as APIs diretamente do navegador.
 *
 * Fallback automático: se esta ação falhar, o frontend tenta fetch direto.
 */
export const buscarDadosMundiais = action({
  args: {
    lat: v.float64(),
    lon: v.float64(),
  },
  handler: async (ctx, args): Promise<ProxyResult> => {
    const { lat, lon } = args;
    const fontes: string[] = [];
    const add = (n: string, ok: boolean) => { if (ok) fontes.push(n); };

    // Dispara TODAS as APIs em paralelo
    const [terremotos, desastres_gdacs, emsc_earthquakes, volcanoes, fema_disasters,
      copernicus_activations, noaa_nhc_storms, tsunamis, incendios_nasa,
      owm, weatherapi, meteo] = await Promise.all([
      fetchUSGS().then(r => { add("USGS", r.length > 0); return r; }),
      fetchGDACS().then(r => { add("GDACS", r.length > 0); return r; }),
      fetchEMSC().then(r => { add("EMSC", r.length > 0); return r; }),
      fetchVolcanoes().then(r => { add("USGS Volcano", r.length > 0); return r; }),
      fetchFEMA().then(r => { add("OpenFEMA", r.length > 0); return r; }),
      fetchCopernicus().then(r => { add("Copernicus EMS", r.length > 0); return r; }),
      fetchNOAANHC().then(r => { add("NOAA NHC", r.length > 0); return r; }),
      fetchNwsTsunami().then(r => { add("NOAA Tsunami", r.length > 0); return r; }),
      fetchNASAProxy().then(r => { add("NASA FIRMS", r.length > 0); return r; }),
      fetchOWMProxy(lat, lon).then(r => { add("OpenWeatherMap", r !== null); return r; }),
      fetchWeatherAPIProxy(lat, lon).then(r => { add("WeatherAPI", r !== null); return r; }),
      fetchOpenMeteoProxy(lat, lon).then(r => { add("Open-Meteo", r !== null); return r; }),
    ]);

    // INMET (chamada separada)
    const inmet = await fetchINMETProxy(lat, lon).catch(() => ({ mm: null, estacao: null }));
    if (inmet.mm !== null) add("INMET", true);

    const fontesUnicas = [...new Set(fontes)];

    // ⚠️ Convex limita arrays a 8192 itens. Aplica slice de segurança.
    const MAX_ITEMS = 500;

    return {
      terremotos: terremotos.slice(0, MAX_ITEMS),
      desastres_gdacs: desastres_gdacs.slice(0, MAX_ITEMS),
      cemaden: [],
      meteo,
      incendios_nasa: incendios_nasa.slice(0, MAX_ITEMS),
      tsunamis: tsunamis.slice(0, MAX_ITEMS),
      emsc_earthquakes: emsc_earthquakes.slice(0, MAX_ITEMS),
      volcanoes: volcanoes.slice(0, MAX_ITEMS),
      fema_disasters: fema_disasters.slice(0, MAX_ITEMS),
      copernicus_activations: copernicus_activations.slice(0, MAX_ITEMS),
      noaa_nhc_storms: noaa_nhc_storms.slice(0, MAX_ITEMS),
      owm,
      weatherapi,
      inmet_precip_mm: inmet.mm,
      inmet_estacao: inmet.estacao,
      timestamp_coleta: new Date().toISOString(),
      fontes: fontesUnicas.slice(0, 50),
    };
  },
});
