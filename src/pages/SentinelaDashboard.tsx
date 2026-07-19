import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BrainCircuit,
  ChevronDown,
  CloudRain,
  Crosshair,
  ExternalLink,
  Globe,
  HelpCircle,
  History,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Radar,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  calcularPrevisaoRisco,
  calcularRiscoLocal,
  type NoticiaGlobal,
  type PontoHistorico,
  type PontoPrevisao,
} from "@/lib/risco-local";

import {
  gerarAlertaChuva,
  type AlertaChuva,
} from "@/lib/alerta-chuva";

import {
  buscarDadosMundiais,
  converterDadosParaEventos,
  enriquecerLocalizacao,
  isTempoSevero,
  type EventoCombinado,
} from "@/lib/api-mundiais";

// ── Helper: tempo relativo ───────────────────────────────────────────
function tempoRelativo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const segundos = Math.floor(diff / 1000);
  if (segundos < 10) return "agora";
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

import {
  analisarComLLM,
  type AnaliseLLM,
  type DadosParaAnalise,
} from "@/lib/llm-service";

// ── Fix Leaflet default marker icon (Vite bundler workaround) ────────
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ── Custom marker icons ─────────────────────────────────────────────
const userIcon = L.divIcon({
  className: "bg-transparent",
  html: `<div style="width:18px;height:18px;background:#6366f1;border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(99,102,241,0.5);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

function criarIconeEvento(tipo: string, severidade: number): L.DivIcon {
  const cores: Record<string, string> = {
    enchente: "#3b82f6", deslizamento: "#f59e0b", tempestade: "#8b5cf6",
    ciclone: "#ef4444", seca: "#f97316", queimada: "#ef4444",
    furacão: "#dc2626", tornado: "#9333ea", incêndio: "#ea580c",
    terremoto: "#92400e", nevasca: "#67e8f9", onda_calor: "#f97316",
    monção: "#06b6d4", tufão: "#be123c", vulcão: "#dc2626",
  };
  const cor = cores[tipo] || "#6b7280";
  const tamanho = 12 + severidade * 3;
  return L.divIcon({
    className: "bg-transparent",
    html: `<div style="width:${tamanho}px;height:${tamanho}px;background:${cor};border:2px solid white;border-radius:50%;box-shadow:0 0 12px ${cor}80;opacity:0.9;"></div>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    popupAnchor: [0, -tamanho / 2 - 8],
  });
}

// ── Types ───────────────────────────────────────────────────────────
import type { EventoAnalisado, RiscoResult, StatusAlerta } from "@/lib/risco-local";

// ── MapController ───────────────────────────────────────────────────
function MapController({
  centro,
  eventos,
  userPos,
}: {
  centro: [number, number] | null;
  eventos: { lat: number; lon: number; tipo: string; severidade: number; id: string }[];
  userPos: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      if (eventos.length === 0 && userPos) {
        map.flyTo(userPos, 11, { duration: 1.5 });
      } else if (eventos.length > 0) {
        const coords = eventos
          .map((e) => [e.lat, e.lon] as [number, number])
          .filter(([lat, lon]) => typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon));
        if (coords.length > 0) {
          const bounds = L.latLngBounds(coords);
          if (userPos) bounds.extend(userPos);
          map.fitBounds(bounds, { padding: [60, 60], duration: 1.2 });
        } else if (userPos) {
          map.flyTo(userPos, 10, { duration: 1.5 });
        }
      } else if (centro) {
        map.flyTo(centro, 10, { duration: 1.5 });
      }
    } catch (e) {
      console.warn('[MapController] Erro ao ajustar bounds do mapa:', e);
      if (userPos) map.flyTo(userPos, 10, { duration: 1 });
    }
  }, [eventos, userPos, centro, map]);

  return null;
}

// ── SafeCircle — evita erro _leaflet_pos renderizando Circle só após init ──
function SafeCircle({ center, radius }: { center: [number, number]; radius: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  // Valida coordenadas antes de renderizar
  if (!center || !Array.isArray(center) || center.length < 2 ||
      typeof center[0] !== 'number' || typeof center[1] !== 'number' ||
      isNaN(center[0]) || isNaN(center[1])) {
    return null;
  }
  return (
    <Circle
      key={`sc-${Number(center[0]).toFixed(2)}-${Number(center[1]).toFixed(2)}-${radius}`}
      center={[Number(center[0]), Number(center[1])]}
      radius={radius}
      pathOptions={{
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.12,
        weight: 2,
        dashArray: "6 6",
      }}
    />
  );
}

// ── Sound Alert (Web Audio API) ────────────────────────────────────
function tocarAlertaSonoro() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Cria osciladores para um som de alerta intermitente
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.setValueAtTime(660, ctx.currentTime + 0.15);

    osc2.type = "square";
    osc2.frequency.setValueAtTime(440, ctx.currentTime);

    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    gain2.gain.setValueAtTime(0.08, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc1.connect(gain1).connect(ctx.destination);
    osc2.connect(gain2).connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.4);

    // Segundo pulso após 0.7s
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sawtooth";
    osc3.frequency.setValueAtTime(880, ctx.currentTime + 0.7);
    osc3.frequency.setValueAtTime(660, ctx.currentTime + 0.85);
    gain3.gain.setValueAtTime(0.15, ctx.currentTime + 0.7);
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.7);
    osc3.stop(ctx.currentTime + 1.2);
  } catch {
    // Áudio não disponível — ignora
  }
}

// ── Notificação Push-style ───────────────────────────────────────────
async function solicitarPermissaoNotificacao(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("SentinelaGlobal", {
        body: "🔔 Notificações ativadas! Alertas de risco em tempo real.",
        icon: "/favicon.svg",
        tag: "sentinela-ativacao",
      });
    }
    return permission === "granted";
  } catch {
    return false;
  }
}

function enviarNotificacaoBrowser(titulo: string, mensagem: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    // Vibração para dispositivos móveis
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }

    // Cria notificação com ação "Ver mapa"
    const notif = new Notification(titulo, {
      body: mensagem,
      icon: "/favicon.svg",
      tag: "sentinela-alerta",
      requireInteraction: true,
      actions: [
        { action: "ver-mapa", title: "🗺️ Ver mapa" },
        { action: "ignorar", title: "✖️ Ignorar" },
      ],
    } as NotificationOptions & { actions: Array<{ action: string; title: string }> });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    notif.addEventListener("action", (event: Event) => {
      const e = event as { action?: string };
      if (e.action === "ver-mapa") {
        window.focus();
        // Rola suavemente para o mapa
        const mapaEl = document.querySelector(".leaflet-container");
        if (mapaEl) mapaEl.scrollIntoView({ behavior: "smooth" });
      }
      notif.close();
    });
  } catch {
    // Notificação falhou — ignora
  }
}

// Helper: extrai nome da fonte pelo ID do evento
function extrairFonte(id: string): string | null {
  if (id.startsWith("usgs_volcano_")) return "USGS Volcano";
  if (id.startsWith("usgs_")) return "USGS";
  if (id.startsWith("gdacs_")) return "GDACS";
  if (id.startsWith("cemaden_")) return "Cemaden";
  if (id.startsWith("firms_") || id.startsWith("nasa_firms_")) return "NASA FIRMS";
  if (id.startsWith("noaa_tsunami_")) return "NOAA Tsunami";
  if (id.startsWith("emsc_")) return "EMSC";
  if (id.startsWith("fema_")) return "OpenFEMA";
  if (id.startsWith("cop_") || id.startsWith("copernicus_")) return "Copernicus EMS";
  if (id.startsWith("nhc_")) return "NOAA NHC";
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────
function nivelCor(nivel: string): string {
  switch (nivel) {
    case "critico": return "text-rose-400";
    case "alto": return "text-orange-400";
    case "moderado": return "text-amber-400";
    default: return "text-emerald-400";
  }
}

function nivelBg(nivel: string): string {
  switch (nivel) {
    case "critico": return "bg-rose-500/10 border-rose-500/30";
    case "alto": return "bg-orange-500/10 border-orange-500/30";
    case "moderado": return "bg-amber-500/10 border-amber-500/30";
    default: return "bg-emerald-500/10 border-emerald-500/30";
  }
}

function tipoIcone(tipo: string): string {
  const icones: Record<string, string> = {
    enchente: "🌊", deslizamento: "⛰️", tempestade: "⛈️",
    ciclone: "🌀", seca: "☀️", queimada: "🔥",
    furacão: "🌀", tornado: "🌪️", incêndio: "🔥",
    terremoto: "🏚️", nevasca: "❄️", onda_calor: "🌡️",
    monção: "🌧️", tufão: "🌀", vulcão: "🌋",
  };
  return icones[tipo] || "⚠️";
}

// ── Componente de Círculo de Risco ──────────────────────────────────
function RiscoCirculo({ valor }: { valor: number }) {
  const cor =
    valor > 80 ? "stroke-rose-500" :
    valor > 60 ? "stroke-orange-500" :
    valor > 30 ? "stroke-amber-500" :
    "stroke-emerald-500";

  const raio = 60;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (valor / 100) * circunferencia;

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" className="transform -rotate-90">
        <circle
          cx="72" cy="72" r={raio}
          fill="none"
          stroke="oklch(1 1 0 / 0.08)"
          strokeWidth="8"
        />
        <circle
          cx="72" cy="72" r={raio}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          className={`transition-all duration-1000 ease-out ${cor}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight">{valor.toFixed(0)}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">% risco</span>
      </div>
    </div>
  );
}

// ── SVG Precipitation 24h History Chart ──────────────────────────
function SvgPrecipHistChart({
  precipitacao,
  horarios,
  height,
}: {
  precipitacao: number[];
  horarios: string[];
  height: number;
}) {
  const width = 800;
  const pad = { top: 12, right: 8, bottom: 24, left: 32 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxPrecip = Math.max(...precipitacao, 2);
  const range = maxPrecip || 1;

  const n = precipitacao.length;
  if (n === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
        Sem dados históricos
      </div>
    );
  }

  const barW = Math.min(14, (chartW - n * 1) / n);
  const gap = Math.max(1, (chartW - n * barW) / Math.max(n - 1, 1));

  function getBarColor(mm: number): string {
    if (mm > 25) return "#ef444480";
    if (mm > 5) return "#f59e0b80";
    if (mm > 0) return "#6366f180";
    return "#1e293b30";
  }

  const scaleX = (i: number) => pad.left + i * (barW + gap);
  const scaleY = (v: number) => pad.top + chartH - (v / range) * chartH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid horizontal */}
      {[0, Math.round(maxPrecip / 2) || 1, maxPrecip].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={scaleY(v)} x2={width - pad.right} y2={scaleY(v)} stroke="oklch(1 1 0 / 0.06)" strokeWidth={1} />
          <text x={pad.left - 4} y={scaleY(v) + 3} textAnchor="end" fill="oklch(0.65 0.03 280)" fontSize={9}>{v.toFixed(0)}</text>
        </g>
      ))}

      {/* Barras */}
      {precipitacao.map((mm, i) => {
        const x = scaleX(i);
        const y = scaleY(mm);
        const h = chartH - (mm / range) * chartH;
        return (
          <g key={`bar-${i}`}>
            <rect x={x} y={y} width={barW} height={h} rx={1} ry={1} fill={getBarColor(mm)} className="transition-all duration-300" />
          </g>
        );
      })}

      {/* Eixo X — labels de hora (a cada 3h) */}
      {precipitacao.map((_, i) => {
        const hora = new Date(horarios[i] || Date.now()).getHours();
        if (i % 3 !== 0 && i !== n - 1 && i !== 0) return null;
        return (
          <text
            key={`x-${i}`}
            x={scaleX(i) + barW / 2}
            y={height - 2}
            textAnchor="middle"
            fill="oklch(0.65 0.03 280)"
            fontSize={8}
          >
            {hora.toString().padStart(2, "0")}h
          </text>
        );
      })}
    </svg>
  );
}

// ── SVG Precipitation Forecast Chart (barras + linha probabilidade) ─
function SvgPrecipChart({
  precipitacao,
  probabilidade,
  codigos,
  height,
}: {
  precipitacao: number[];
  probabilidade: number[];
  codigos: number[];
  height: number;
}) {
  const width = 800;
  const pad = { top: 16, right: 8, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxPrecip = Math.max(...precipitacao, 2);
  const range = maxPrecip || 1;

  const n = precipitacao.length;
  if (n === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
        Sem dados de previsão
      </div>
    );
  }

  const barW = Math.min(60, (chartW - (n - 1) * 10) / n);
  const gap = (chartW - n * barW) / Math.max(n - 1, 1);

  // Cores baseadas no código WMO / intensidade
  function getBarColor(mm: number, codigo: number): string {
    if (codigo >= 95) return "url(#severeGrad)"; // tempestade
    if (mm > 25) return "url(#heavyGrad)";
    if (mm > 5) return "url(#moderateGrad)";
    if (mm > 0) return "url(#lightGrad)";
    return "#1e293b"; // sem chuva
  }

  const scaleX = (i: number) => pad.left + i * (barW + gap);
  const scaleY = (v: number) => pad.top + chartH - (v / range) * chartH;
  const scaleYProb = (p: number) => pad.top + chartH - (p / 100) * chartH;

  // Grid lines
  const gridPrecip = [0, Math.round(maxPrecip / 2), maxPrecip].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lightGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="moderateGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="heavyGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="severeGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Grid horizontal */}
      {gridPrecip.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={scaleY(v)}
            x2={width - pad.right}
            y2={scaleY(v)}
            stroke="oklch(1 1 0 / 0.06)"
            strokeWidth={1}
          />
          <text
            x={pad.left - 4}
            y={scaleY(v) + 3}
            textAnchor="end"
            fill="oklch(0.65 0.03 280)"
            fontSize={9}
          >
            {v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* Barras de precipitação */}
      {precipitacao.map((mm, i) => {
        const x = scaleX(i);
        const y = scaleY(mm);
        const h = chartH - (mm / range) * chartH;
        return (
          <g key={`bar-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={3}
              ry={3}
              fill={getBarColor(mm, codigos[i] ?? 0)}
              className="transition-all duration-500"
            />
            {/* Valor em mm no topo da barra */}
            {mm > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fill={mm > 25 ? "#ef4444" : "oklch(0.65 0.03 280)"}
                fontSize={8}
                fontWeight={mm > 25 ? "bold" : "normal"}
              >
                {mm.toFixed(1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Linha de probabilidade */}
      {probabilidade.length > 0 && probabilidade.some((p) => p > 0) && (
        <>
          {probabilidade.map((p, i) => {
            if (i === 0 || p === 0) return null;
            const x1 = scaleX(i - 1) + barW / 2;
            const y1 = scaleYProb(probabilidade[i - 1]);
            const x2 = scaleX(i) + barW / 2;
            const y2 = scaleYProb(p);
            return (
              <line
                key={`prob-line-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#22d3ee"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            );
          })}
          {probabilidade.map((p, i) => (
            p > 0 && (
              <circle
                key={`prob-dot-${i}`}
                cx={scaleX(i) + barW / 2}
                cy={scaleYProb(p)}
                r={3}
                fill="#22d3ee"
                stroke="#0ea5e9"
                strokeWidth={1}
              />
            )
          ))}
        </>
      )}

      {/* Eixo X — labels de hora */}
      {precipitacao.map((_, i) => {
        const agora = new Date();
        const hora = (agora.getHours() + i + 1) % 24;
        return (
          <text
            key={`x-${i}`}
            x={scaleX(i) + barW / 2}
            y={height - 4}
            textAnchor="middle"
            fill="oklch(0.65 0.03 280)"
            fontSize={9}
          >
            {hora.toString().padStart(2, "0")}h
          </text>
        );
      })}
    </svg>
  );
}

// ── SVG Line Chart Component (zero dependências externas) ─────────
function SvgLineChart({
  data,
  forecast,
  height,
  threshold,
}: {
  data: { risco_geral: number; timestamp: string }[];
  forecast: { risco_previsto: number; timestamp: string }[];
  height: number;
  threshold: number;
}) {
  const width = 800;
  const pad = { top: 12, right: 8, bottom: 20, left: 32 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const allValues = [...data.map((d) => d.risco_geral), ...forecast.map((f) => f.risco_previsto), threshold];
  const maxVal = Math.max(...allValues, 5);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  // Junta histórico + previsão para pontos únicos
  const pontos = data.map((d) => ({ x: d.timestamp, y: d.risco_geral, tipo: "historico" as const }));
  const pontosPrev = forecast.map((f) => ({ x: f.timestamp, y: f.risco_previsto, tipo: "previsao" as const }));
  const todos = [...pontos, ...pontosPrev];

  if (todos.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
        Dados insuficientes para o gráfico
      </div>
    );
  }

  const scaleX = (i: number) => pad.left + (i / Math.max(todos.length - 1, 1)) * chartW;
  const scaleY = (v: number) => pad.top + chartH - ((v - minVal) / range) * chartH;

  // Gera path do histórico (primeiros N pontos)
  const linhaHistorico = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.y)}`)
    .join(" ");

  // Gera path da previsão (últimos M pontos)
  const idxInicioPrevisao = pontos.length;
  const linhaPrevisao = pontosPrev
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(idxInicioPrevisao + i)} ${scaleY(p.y)}`)
    .join(" ");

  const thresholdY = scaleY(threshold);

  // Grid lines
  const gridLines = [0, 20, 40, 60, 80, 100].filter((v) => v <= maxVal);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid horizontal */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            y1={scaleY(v)}
            x2={width - pad.right}
            y2={scaleY(v)}
            stroke="oklch(1 1 0 / 0.06)"
            strokeWidth={1}
          />
          <text
            x={pad.left - 4}
            y={scaleY(v) + 3}
            textAnchor="end"
            fill="oklch(0.65 0.03 280)"
            fontSize={9}
          >
            {v}%
          </text>
        </g>
      ))}

      {/* Threshold line (80%) */}
      <line
        x1={pad.left}
        y1={thresholdY}
        x2={width - pad.right}
        y2={thresholdY}
        stroke="#ef4444"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={width - pad.right - 2}
        y={thresholdY - 3}
        textAnchor="end"
        fill="#ef4444"
        fontSize={8}
      >
        Alerta 80%
      </text>

      {/* Linha do histórico */}
      <path d={linhaHistorico} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />

      {/* Linha da previsão */}
      {forecast.length > 0 && pontos.length > 0 && (
        <path d={linhaPrevisao} fill="none" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3" strokeLinejoin="round" />
      )}

      {/* Dots do histórico */}
      {pontos.map((p, i) => (
        <circle key={`h-${i}`} cx={scaleX(i)} cy={scaleY(p.y)} r={1.5} fill="#6366f1" />
      ))}

      {/* Dots da previsão */}
      {pontosPrev.map((p, i) => (
        <circle
          key={`p-${i}`}
          cx={scaleX(idxInicioPrevisao + i)}
          cy={scaleY(p.y)}
          r={1.5}
          fill="#a78bfa"
          opacity={0.7}
        />
      ))}

      {/* Eixo X — horas */}
      {todos.length > 1 &&
        [0, Math.floor(todos.length / 2), todos.length - 1].map((i) => {
          const d = new Date(todos[i]?.x || "");
          const label = isNaN(d.getTime()) ? "" : `${d.getHours().toString().padStart(2, "0")}h`;
          return (
            <text
              key={`x-${i}`}
              x={scaleX(i)}
              y={height - 2}
              textAnchor="middle"
              fill="oklch(0.65 0.03 280)"
              fontSize={9}
            >
              {label}
            </text>
          );
        })}
    </svg>
  );
}

// ── Tipos de evento para o filtro do mapa ───────────────────────
const TODOS_TIPOS_MAPA = [
  { tipo: "terremoto", icone: "🏚️", cor: "#92400e" },
  { tipo: "tsunami", icone: "🌊", cor: "#0ea5e9" },
  { tipo: "vulcão", icone: "🌋", cor: "#dc2626" },
  { tipo: "furacão", icone: "🌀", cor: "#dc2626" },
  { tipo: "ciclone", icone: "🌀", cor: "#ef4444" },
  { tipo: "tufão", icone: "🌀", cor: "#be123c" },
  { tipo: "queimada", icone: "🔥", cor: "#ea580c" },
  { tipo: "incêndio", icone: "🔥", cor: "#ea580c" },
  { tipo: "enchente", icone: "🌊", cor: "#3b82f6" },
  { tipo: "deslizamento", icone: "⛰️", cor: "#f59e0b" },
  { tipo: "tempestade", icone: "⛈️", cor: "#8b5cf6" },
  { tipo: "tornado", icone: "🌪️", cor: "#9333ea" },
];

// ── Categorias de notícias por tipo de catástrofe ──────────────────
const CATEGORIAS_NOTICIAS = [
  { tipo: "terremoto", icone: "🏚️" },
  { tipo: "tsunami", icone: "🌊" },
  { tipo: "vulcão", icone: "🌋" },
  { tipo: "furacão", icone: "🌀" },
  { tipo: "ciclone", icone: "🌀" },
  { tipo: "tufão", icone: "🌀" },
  { tipo: "queimada", icone: "🔥" },
  { tipo: "incêndio", icone: "🔥" },
  { tipo: "enchente", icone: "🌊" },
  { tipo: "deslizamento", icone: "⛰️" },
  { tipo: "tempestade", icone: "⛈️" },
  { tipo: "tornado", icone: "🌪️" },
  { tipo: "seca", icone: "☀️" },
  { tipo: "nevasca", icone: "❄️" },
  { tipo: "onda_calor", icone: "🌡️" },
  { tipo: "monção", icone: "🌧️" },
];

// ── Dashboard Principal ─────────────────────────────────────────────
export default function SentinelaDashboard() {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [analise, setAnalise] = useState<RiscoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoErro, setGeoErro] = useState<string | null>(null);

  // Alerta ativo (polling)
  const [alertaAtivo, setAlertaAtivo] = useState<StatusAlerta | null>(null);
  const [modalAlertaAberto, setModalAlertaAberto] = useState(false);

  // Notificações
  const [notifPermitida, setNotifPermitida] = useState(
    () => "Notification" in window && Notification.permission === "granted"
  );
  const [notifBadge, setNotifBadge] = useState(0);
  const ultimoAlertaNotificado = useRef<string | null>(null);

  // Expansão dos eventos
  const [eventosExpandidos, setEventosExpandidos] = useState(false);

  // ── Histórico de risco para o gráfico ────────────────────────
  const [historicoRisco, setHistoricoRisco] = useState<PontoHistorico[]>(() => []);
  const [previsaoRisco, setPrevisaoRisco] = useState<PontoPrevisao[]>(() => []);
  const [chartExpandido, setChartExpandido] = useState(false);
  const [mostrarPrevisao, setMostrarPrevisao] = useState(true);

  // ── Notícias Globais (só aparece se existirem) ─────────────
  const [noticias, setNoticias] = useState<NoticiaGlobal[]>([]);
  const [noticiasExpandidas, setNoticiasExpandidas] = useState(false);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({});

  // ── Relógio em tempo real (atualiza timestamps a cada 30s) ──
  const [ticTac, setTicTac] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTicTac((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ── AI Insights ──────────────────────────────────────────────
  const [insightsAbertos, setInsightsAbertos] = useState(false);

  // ── Trava de processamento para evitar loop de análises concorrentes ──
  const processandoRef = useRef(false);

  // ── Polling ref para intervalo dinâmico ─────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cooldown de 15 min (economia: sem eventos próximos → não consulta) ──
  const [cooldownAte, setCooldownAte] = useState<number | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modo Demonstração ────────────────────────────────────────
  const [modoDemonstracao, setModoDemonstracao] = useState(false);

  // ── PIX / Apoie o Projeto ────────────────────────────────────
  const { signOut } = useAuth();

  // ── Raio de busca dinâmico (5km a 1000km) — inicial 20km ──────
  const [raioBusca, setRaioBusca] = useState(20);

  // ── Dados Reais vs. Fontes Ativas ────────────────────────────
  const [fontesAtivas, setFontesAtivas] = useState<string[]>([]);
  const [analiseLLM, setAnaliseLLM] = useState<AnaliseLLM | null>(null);
  const [modeloLLM, setModeloLLM] = useState("Simulação local");

  // ── Alerta de Chuva (classificação INMET) ─────────────────────
  const [alertaChuva, setAlertaChuva] = useState<AlertaChuva | null>(null);
  const [precipitacaoHoraria, setPrecipitacaoHoraria] = useState<{
    mm: number[];
    prob: number[];
    codigos: number[];
  }>({ mm: [], prob: [], codigos: [] });
  const [precipChartExpandido, setPrecipChartExpandido] = useState(false);

  // ── Histórico de Precipitação 24h ──────────────────────────
  const [precip24h, setPrecip24h] = useState<{
    mm: number[];
    prob: number[];
    codigos: number[];
    horarios: string[];
  }>({ mm: [], prob: [], codigos: [], horarios: [] });
  const [precipHistExpandido, setPrecipHistExpandido] = useState(false);

  // ── Filtro de tipos no mapa mundial ─────────────────────────
  const [filtroTipos, setFiltroTipos] = useState<Set<string>>(new Set());
  const [mapaMundialExpandido, setMapaMundialExpandido] = useState(false);

  // ── Eventos reais (NÃO filtrados por raioBusca) para o mapa mundial ──
  const [eventosMundiais, setEventosMundiais] = useState<EventoCombinado[]>([]);

  // ── Geolocalização ────────────────────────────────────────────
  const handleObterLocalizacao = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoErro("Geolocalização não é suportada pelo navegador.");
      return;
    }

    setGeoLoading(true);
    setGeoErro(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserPos([lat, lon]);
        setGeoLoading(false);
        // Dispara análise automaticamente
        handleMonitorar(lat, lon);
      },
      (error) => {
        setGeoErro(
          error.code === error.PERMISSION_DENIED
            ? "Permissão de localização negada. Ative nas configurações do navegador."
            : "Não foi possível obter sua localização."
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // ── Monitorar (com dados REAIS + LLM + fallback local) ──────
  async function handleMonitorar(lat: number, lon: number, nome?: string) {
    // ⛔ TRAVA: impede execução concorrente (evita loop de polling)
    if (processandoRef.current) return;
    processandoRef.current = true;

    setLoading(true);
    setErro(null);

    let fontesEncontradas: string[] = [];
    let eventosReais: EventoCombinado[] = [];
    let dadosClima = {
      temperatura: null as number | null,
      precipitacao: null as number | null,
      vento: null as number | null,
      probChuva: null as number | null,
      tempoSevero: false,
      codigoTempo: null as number | null,
      codigoTempoDiario: null as number | null,
      precipitacaoDiaria: null as number | null,
    };

    try {
      // 1. Busca dados REAIS de todas as APIs mundiais
      const dados = await buscarDadosMundiais(lat, lon);

      if (dados.fontes.length > 0) {
        fontesEncontradas = dados.fontes;
        // Converte dados reais para eventos compatíveis
        eventosReais = converterDadosParaEventos(dados);
        // Enriquece localizações de eventos remotos (queimadas, etc.) com nomes reais via Nominatim
        eventosReais = await enriquecerLocalizacao(eventosReais);
        // Armazena TODOS os eventos (sem filtro de raio) para o mapa mundial
        setEventosMundiais(eventosReais);

        // Dados meteorológicos
        if (dados.meteo) {
          dadosClima = {
            temperatura: dados.meteo.temperatura_c,
            precipitacao: dados.meteo.precipitacao_mm,
            vento: dados.meteo.vento_kmh,
            probChuva: dados.meteo.prob_precipitacao_max,
            tempoSevero: isTempoSevero(dados.meteo.codigo_tempo) || isTempoSevero(dados.meteo.codigo_tempo_diario),
            codigoTempo: dados.meteo.codigo_tempo,
            codigoTempoDiario: dados.meteo.codigo_tempo_diario,
            precipitacaoDiaria: dados.meteo.precipitacao_diaria_mm,
          };
        }
      }

      // Filtra eventos apenas das últimas 24h
    const vinteQuatroHoras = Date.now() - 24 * 60 * 60 * 1000;
    eventosReais = eventosReais.filter(ev => ev.timestamp >= vinteQuatroHoras);

    // 2. Calcula risco usando APENAS dados reais (se houverem) — sem fallback simulado
    const resultado = calcularRiscoLocal(lat, lon, nome, eventosReais, raioBusca);

      if (fontesEncontradas.length > 0) {
        setFontesAtivas(fontesEncontradas);
      }

      setAnalise(resultado);

      // 3. Análise LLM real (tenta freebuff.com.completion())
      const dadosParaLLM: DadosParaAnalise = {
        risco_geral: resultado.risco_geral_usuario,
        nivel_alerta: resultado.nivel_alerta,
        eventos_proximos: resultado.eventos_analisados.slice(0, 5).map((e) => ({
          tipo: e.tipo,
          severidade: e.severidade,
          distancia_km: e.distancia_km,
          impacto: e.impacto_percentual,
          descricao: e.analise_llm.slice(0, 200),
          fonte: e.id.startsWith("usgs") ? "USGS" : e.id.startsWith("gdacs") ? "GDACS" : e.id.startsWith("cemaden") ? "Cemaden" : "Simulação",
        })),
        fontes_ativas: fontesEncontradas.length > 0 ? fontesEncontradas : ["Simulação local"],
        temperatura_c: dadosClima.temperatura,
        precipitacao_mm: dadosClima.precipitacao,
        vento_kmh: dadosClima.vento,
        probabilidade_chuva: dadosClima.probChuva,
      };

      const llmResult = await analisarComLLM(dadosParaLLM);
      setAnaliseLLM(llmResult);
      setModeloLLM(llmResult.modelo_utilizado);

      // 4. Adiciona ao histórico do gráfico
      setHistoricoRisco((prev) => {
        const novo: PontoHistorico = {
          risco_geral: resultado.risco_geral_usuario,
          nivel_alerta: resultado.nivel_alerta,
          timestamp: resultado.timestamp,
        };
        return [...prev, novo].slice(-30);
      });

      // ⏱ Cooldown de 15min se NENHUM evento dentro de 30km (usa eventos NÃO filtrados)
      const kmPorGrau = 111.32;
      const temEventoProximo = eventosReais.some(ev => {
        const dLat = (ev.lat - lat) * kmPorGrau;
        const dLon = (ev.lon - lon) * kmPorGrau * Math.cos(lat * Math.PI / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon) <= 30;
      });
      if (!temEventoProximo) {
        const expiraEm = Date.now() + 15 * 60 * 1000;
        setCooldownAte(expiraEm);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          setCooldownAte(null);
          cooldownTimerRef.current = null;
        }, 15 * 60 * 1000);
      } else {
        if (cooldownTimerRef.current) {
          clearTimeout(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
        setCooldownAte(null);
      }

      // 5. Se risco > 80%, alerta
      if (resultado.risco_geral_usuario > 80) {
        const ev = resultado.eventos_analisados[0];
        const alerta: StatusAlerta = {
          alerta_ativo: true,
          risco_geral: resultado.risco_geral_usuario,
          mensagem_alerta: resultado.mensagem_alerta,
          evento_critico: ev || null,
          timestamp_analise: resultado.timestamp,
          background_ativo: true,
        };
        setAlertaAtivo(alerta);
        setModalAlertaAberto(true);

        const chaveAlerta = resultado.timestamp;
        if (ultimoAlertaNotificado.current !== chaveAlerta) {
          ultimoAlertaNotificado.current = chaveAlerta;
          setNotifBadge((prev) => prev + 1);
          tocarAlertaSonoro();
          enviarNotificacaoBrowser(
            "🚨 Alerta Crítico — SentinelaGlobal",
            `Risco de ${resultado.risco_geral_usuario.toFixed(0)}% detectado! ${resultado.mensagem_alerta.slice(0, 100)}`
          );
        }
      } else {
        setAlertaAtivo({
          alerta_ativo: false,
          risco_geral: resultado.risco_geral_usuario,
          mensagem_alerta: null,
          evento_critico: null,
          timestamp_analise: resultado.timestamp,
          background_ativo: true,
        });
      }

      // 6. Atualiza previsão
      setPrevisaoRisco(calcularPrevisaoRisco([...historicoRisco, {
        risco_geral: resultado.risco_geral_usuario,
        nivel_alerta: resultado.nivel_alerta,
        timestamp: resultado.timestamp,
      }].slice(-30)));

      // 7. Atualiza notícias — só se existirem dados reais
      if (fontesEncontradas.length > 0) {
        // Gera notícias a partir dos eventos reais das APIs
        const noticiasReais: NoticiaGlobal[] = eventosReais
          .sort((a, b) => b.severidade - a.severidade || b.timestamp - a.timestamp)
          .slice(0, 50)
          .map((ev, i) => {
            // Gera URL da fonte baseada no prefixo do ID
            let fonteUrl = "https://www.gdacs.org";
            if (ev.id.startsWith("usgs_")) {
              fonteUrl = `https://earthquake.usgs.gov/earthquakes/eventpage/${ev.id.replace("usgs_", "")}`;
            } else            if (ev.id.startsWith("gdacs_")) {
              const gdacsId = ev.id.replace("gdacs_", "");
              // Mapeia tipo do evento para parâmetro GDACS
              const tipoGdacs: Record<string, string> = {
                terremoto: "EQ", ciclone: "TC", enchente: "FL",
                incêndio: "WF", vulcão: "VO", seca: "DR",
              };
              const eventoType = tipoGdacs[ev.tipo] || "FL";
              fonteUrl = `https://www.gdacs.org/report.aspx?eventtype=${eventoType}&eventid=${gdacsId}`;
            } else if (ev.id.startsWith("firms_")) {
              fonteUrl = `https://firms.modaps.eosdis.nasa.gov/map/#z:6;c:${ev.lon},${ev.lat};t:adv-points`;
            }
            return {
              id: `real_news_${i}`,
              titulo: `${ev.tipo.charAt(0).toUpperCase() + ev.tipo.slice(1)} em ${ev.regiao}, ${ev.pais}`,
              resumo: ev.descricao,
              tipo: ev.tipo,
              pais: ev.pais,
              severidade: Math.round(ev.severidade),
              timestamp: new Date(ev.timestamp).toISOString(),
              fonte_url: fonteUrl,
            };
          });
        setNoticias(noticiasReais);
      } else {
        // Sem dados reais — não mostra notícias
        setNoticias([]);
      }
      // 8. Atualiza alerta de chuva (classificação INMET / Open-Meteo / OWM / WeatherAPI)
      // Prioridade: dados INMET > Open-Meteo > OWM > WeatherAPI
      const precipMm = dados.inmet_precip_mm ?? dados.meteo?.precipitacao_mm ?? dados.owm?.precipitacao_mm ?? dados.weatherapi?.precipitacao_mm ?? null;
      const codTempo = dados.meteo?.codigo_tempo ?? dados.owm?.codigo_tempo ?? dados.weatherapi?.codigo_tempo ?? null;
      const codTempoDiario = dados.meteo?.codigo_tempo_diario ?? null;
      const precipDiaria = dados.meteo?.precipitacao_diaria_mm ?? null;
      const probMax = dados.meteo?.prob_precipitacao_max ?? null;

      const alerta = gerarAlertaChuva(
        precipMm,
        precipDiaria,
        probMax,
        codTempo,
        codTempoDiario,
        fontesEncontradas,
      );
      setAlertaChuva(alerta);

      // Armazena dados horários para o gráfico de previsão de chuva
      if (dados.meteo?.precipitacao_horaria_proximas_6h.length) {
        setPrecipitacaoHoraria({
          mm: dados.meteo.precipitacao_horaria_proximas_6h,
          prob: dados.meteo.probabilidade_horaria_proximas_6h,
          codigos: dados.meteo.codigos_tempo_horarios,
        });
      }
      // Armazena dados de histórico 24h para o gráfico
      if (dados.meteo?.precipitacao_horaria_24h.length) {
        setPrecip24h({
          mm: dados.meteo.precipitacao_horaria_24h,
          prob: dados.meteo.probabilidade_horaria_24h,
          codigos: dados.meteo.codigos_tempo_24h,
          horarios: dados.meteo.horarios_24h,
        });
      }

      setInsightsAbertos(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao analisar riscos.");
    } finally {
      setLoading(false);
      // Libera a trava após delay mínimo para evitar looping
      setTimeout(() => { processandoRef.current = false; }, 500);
    }
  }

  // ── Desktop: pedir localização ao montar ──────────────────────
  useEffect(() => {
    handleObterLocalizacao();
  }, []);

  // ── Tooltip helper para modo demonstração ────────────────────
  function TagDemo({ texto, children }: { texto: string; children: ReactNode }) {
    if (!modoDemonstracao) return <>{children}</>;
    return (
      <div className="relative group">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-[9999] pointer-events-none">
          <div className="glass-panel rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-lg border border-indigo-500/30">
            <span className="text-indigo-400 font-medium">💡 {texto}</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-indigo-500/30" />
          </div>
        </div>
        {children}
      </div>
    );
  }

  // ── Dados para os mapas ────────────────────────────────────────
  // Eventos do risco local (filtrados por raioBusca) — para o mapa de localização
  const eventosMapaLocal =
    analise?.eventos_analisados
      .filter(ev => typeof ev.lat === 'number' && typeof ev.lon === 'number' && !isNaN(ev.lat) && !isNaN(ev.lon))
      .filter(ev => (ev.lat !== 0 || ev.lon !== 0)) // remove inválidos
      .filter(ev => !ev.id.startsWith("noaa_tsunami_")) // tsunamis não aparecem no mapa local
      .map(ev => ({
        id: ev.id,
        tipo: ev.tipo,
        severidade: ev.severidade,
        lat: typeof ev.lat === 'number' ? ev.lat : 0,
        lon: typeof ev.lon === 'number' ? ev.lon : 0,
        distancia_km: ev.distancia_km,
        impacto_percentual: ev.impacto_percentual,
        recomendacao: ev.recomendacao,
      })) || [];

  // Eventos MUNDIAIS (todos, sem filtro de raio) — para o mapa mundial
  // Converte de EventoCombinado para o formato do mapa
  const eventosMundiaisComLatLon = eventosMundiais
    .filter(ev => typeof ev.lat === 'number' && typeof ev.lon === 'number' && !isNaN(ev.lat) && !isNaN(ev.lon))
    .filter(ev => (ev.lat !== 0 || ev.lon !== 0))
    .map(ev => ({
      id: ev.id,
      tipo: ev.tipo,
      severidade: ev.severidade,
      lat: typeof ev.lat === 'number' ? ev.lat : 0,
      lon: typeof ev.lon === 'number' ? ev.lon : 0,
      distancia_km: 0, // não aplicável no mapa mundial
      impacto_percentual: Math.round(ev.severidade * 20), // estimativa
      recomendacao: `Evento de ${ev.tipo} em ${ev.pais} — Fonte: ${ev.fonte}`,
    }));

  // Filtra eventos mundiais pelo tipo selecionado
  const eventosMundiaisFiltrados = filtroTipos.size === 0
    ? eventosMundiaisComLatLon
    : eventosMundiaisComLatLon.filter(ev => filtroTipos.has(ev.tipo));

  const centroMapa: [number, number] | null = userPos;

  // ── Background color based on risk ────────────────────────────
  const risco = alertaAtivo?.risco_geral ?? analise?.risco_geral_usuario ?? 0;

  // ── Polling dinâmico — respeita cooldown de 15min sem eventos ──
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (!userPos) return;

    // Se estiver em cooldown, não agenda polling (economia de requisições)
    if (cooldownAte !== null && Date.now() < cooldownAte) return;

    const intervalo = risco > 80 ? 120000 : 600000; // 2min se urgente, 10min se seguro

    pollingRef.current = setInterval(() => {
      if (userPos) {
        handleMonitorar(userPos[0], userPos[1]);
      }
    }, intervalo);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [userPos, risco, cooldownAte]);

  // ── Reanalisar quando o raio de busca mudar ─────────────────
  useEffect(() => {
    if (userPos) {
      handleMonitorar(userPos[0], userPos[1]);
    }
  }, [raioBusca]);

  const bgClass =
    risco > 80
      ? "bg-rose-950/40"
      : risco > 60
        ? "bg-orange-950/30"
        : "bg-transparent";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen flex flex-col transition-all duration-1000 ${bgClass}`}
    >
      {/* ── Pulsing background overlay for critical risk ── */}
      {risco > 80 && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-rose-500/5 animate-[pulse_2s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-t from-rose-500/10 via-transparent to-transparent" />
        </div>
      )}

      {/* ── Alert Modal ── */}
      <AnimatePresence>
        {modalAlertaAberto && alertaAtivo?.alerta_ativo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalAlertaAberto(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel rounded-3xl p-8 max-w-lg w-full relative z-10 border-rose-500/40"
            >
              <button
                onClick={() => setModalAlertaAberto(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="h-8 w-8 text-rose-400" />
              </div>

              <h2 className="text-xl font-bold text-center mb-2">
                Alerta Crítico de Risco
              </h2>
              <p className="text-3xl font-bold text-rose-400 text-center mb-4">
                {alertaAtivo.risco_geral?.toFixed(0)}% de risco
              </p>

              <div className="glass-subtle rounded-xl p-4 mb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {alertaAtivo.mensagem_alerta}
                </p>
              </div>

              {alertaAtivo.evento_critico && (
                <div className="glass-subtle rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TriangleAlert className="h-4 w-4 text-rose-400" />
                    <span className="text-sm font-medium">
                      {alertaAtivo.evento_critico.tipo.charAt(0).toUpperCase() + alertaAtivo.evento_critico.tipo.slice(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {alertaAtivo.evento_critico.distancia_km.toFixed(0)} km
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alertaAtivo.evento_critico.analise_llm}
                  </p>
                </div>
              )}

              {alertaAtivo.timestamp_analise && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Última análise: {new Date(alertaAtivo.timestamp_analise).toLocaleString("pt-BR")}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-6xl">
        <nav className="glass-panel rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/30 to-rose-500/30 flex items-center justify-center">
              <Radar className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">
              Sentinela<span className="gradient-text">Global</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Botão Ver Demonstração */}
            <button
              onClick={() => setModoDemonstracao(!modoDemonstracao)}
              className={`glass-button rounded-lg px-3 py-1.5 text-[10px] font-medium flex items-center gap-1 transition-colors ${modoDemonstracao ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : ''}`}
            >
              <HelpCircle className="h-3 w-3" />
              {modoDemonstracao ? "Fechar" : "Ver demonstração"}
            </button>
            {/* Botão Sair */}
            <button
              onClick={async () => {
                if (pollingRef.current) clearInterval(pollingRef.current);
                await signOut();
                window.location.href = "/";
              }}
              className="glass-button rounded-lg px-3 py-1.5 text-[10px] font-medium flex items-center gap-1"
            >
              <LogOut className="h-3 w-3" />
              Sair
            </button>
            <div className={`w-2 h-2 rounded-full ${alertaAtivo?.background_ativo ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-[10px] text-muted-foreground">
              {alertaAtivo?.background_ativo ? "Monitorando" : "Inativo"}
            </span>
          </div>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col px-4 pt-24 pb-8">
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6">
          {/* ── Status + Risk Circle ── */}
          <TagDemo texto="Mostra o nível de risco geral, eventos próximos, localização e status do monitoramento em tempo real">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Status do Sistema</h2>
              </div>

              {/* Geolocation Button */}
              <button
                onClick={handleObterLocalizacao}
                disabled={geoLoading || loading}
                className="glass-button rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                {geoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="h-4 w-4" />
                )}
                {userPos ? "Atualizar localização" : "Usar minha localização"}
              </button>
            </div>

            {geoErro && (
              <p className="text-xs text-amber-400 mt-2">{geoErro}</p>
            )}

            {erro && (
              <p className="text-xs text-red-400 mt-2">{erro}</p>
            )}

            {/* Risk Circle + Info */}
            <div className="flex flex-col md:flex-row items-center gap-6 mt-6">
              {/* Círculo de Risco */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {loading ? (
                  <div className="w-36 h-36 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <RiscoCirculo valor={analise?.risco_geral_usuario ?? 0} />
                )}
              </motion.div>

              {/* Info Cards */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Nível de Alerta</p>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold border ${nivelBg(analise?.nivel_alerta ?? "baixo")} ${nivelCor(analise?.nivel_alerta ?? "baixo")}`}>
                    {analise?.nivel_alerta === "critico" || analise?.nivel_alerta === "alto" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {analise?.nivel_alerta ? analise.nivel_alerta.toUpperCase() : "AGUARDANDO"}
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Eventos Próximos</p>
                  <p className="text-2xl font-bold">
                    {analise?.eventos_analisados.length ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    dentro de {raioBusca} km
                  </p>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <Ruler className="h-3 w-3 inline mr-1" />
                    Raio de busca
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="40000"
                      value={raioBusca}
                      onChange={(e) => {
                        const novoRaio = Number(e.target.value);
                        setRaioBusca(novoRaio);
                      }}
                      className="w-full h-1.5 bg-muted/50 rounded-full appearance-none cursor-pointer accent-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/30"
                    />
                    <span className="text-sm font-bold min-w-[3.5rem] text-right">{raioBusca} km</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                    <span>5 km</span>
                    <span>500 km</span>
                    <span>40000 km</span>
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Localização</p>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    {userPos
                      ? `${userPos[0].toFixed(4)}, ${userPos[1].toFixed(4)}`
                      : "Não definida"}
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <CloudRain className="h-3 w-3 inline mr-1" />
                    Precipitação — INMET
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {alertaChuva ? (
                        <>
                          <span className="text-lg">{alertaChuva.classificacao.icone}</span>
                          <div>
                            <span className={`text-sm font-semibold ${alertaChuva.classificacao.cor}`}>
                              {alertaChuva.classificacao.label}
                            </span>
                            <p className="text-[9px] text-muted-foreground">
                              {alertaChuva.precipitacao_atual_mm?.toFixed(1) ?? "0"} mm/h ·
                              {alertaChuva.probabilidade_max !== null && alertaChuva.probabilidade_max > 0
                                ? ` ${alertaChuva.probabilidade_max}% prob.`
                                : " sem previsão"}
                            </p>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Aguardando dados...</span>
                      )}
                    </div>
                    {alertaChuva && alertaChuva.precipitacao_atual_mm !== null && alertaChuva.precipitacao_atual_mm > 0 && (
                      <div className="flex-shrink-0">
                        <div className="flex items-center gap-0.5 h-8">
                          {Array.from({ length: Math.min(Math.round(alertaChuva.precipitacao_atual_mm / 5) + 1, 8) }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 rounded-full ${
                                alertaChuva.nivel === "forte" || alertaChuva.nivel === "severa" || alertaChuva.nivel === "extrema"
                                  ? "bg-rose-500/60"
                                  : "bg-indigo-500/40"
                              }`}
                              style={{ height: `${6 + i * 4}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Badges de classificação — só se alertaChuva existir E não for sem_chuva */}
                  {alertaChuva && alertaChuva.classificacao.nivel !== "sem_chuva" && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[8px] text-muted-foreground bg-muted/30 px-1 py-0.5 rounded-full">
                        {alertaChuva.classificacao.mm_h}
                      </span>
                      {alertaChuva.fontes.slice(0, 2).map((f) => (
                        <span key={f} className="text-[8px] font-medium px-1 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {alertaChuva?.ativo && (
                    <p className="text-[9px] text-rose-400 mt-1 leading-tight">
                      {alertaChuva.mensagem.split("\n")[0]}
                    </p>
                  )}
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Monitoramento</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${alertaAtivo?.background_ativo ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="text-sm">
                      {alertaAtivo?.background_ativo
                        ? risco > 80
                          ? "1min (urgente)"
                          : "5min (seguro)"
                        : "Inativo"}
                    </span>
                  </div>
                </div>
                <div className="glass-subtle rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <Bell className="h-3 w-3 inline mr-1" />
                    Notificações Push
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${notifPermitida ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      <span className="text-sm">
                        {notifPermitida ? "Ativadas" : "Inativas"}
                      </span>
                      {notifBadge > 0 && notifPermitida && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {notifBadge} novas
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!notifPermitida && "Notification" in window && Notification.permission !== "denied" && (
                        <button
                          onClick={async () => {
                            const ok = await solicitarPermissaoNotificacao();
                            setNotifPermitida(ok);
                          }}
                          className="text-[10px] text-primary hover:text-primary/80 underline transition-colors"
                        >
                          Ativar
                        </button>
                      )}
                      {notifPermitida && (
                        <button
                          onClick={() => {
                            tocarAlertaSonoro();
                            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                            enviarNotificacaoBrowser(
                              "🔔 SentinelaGlobal",
                              "Notificação push de teste! Se você está vendo isso, as notificações estão funcionando."
                            );
                          }}
                          className="text-[10px] text-primary hover:text-primary/80 underline transition-colors"
                        >
                          Testar
                        </button>
                      )}
                      {notifPermitida && notifBadge > 0 && (
                        <button
                          onClick={() => setNotifBadge(0)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                  {!notifPermitida && "Notification" in window && Notification.permission === "denied" && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Bloqueadas nas configurações do navegador
                    </p>
                  )}
                  {notifPermitida && (
                    <p className="text-[9px] text-muted-foreground/50 mt-1.5">
                      Alertas críticos ({'>'}80%) disparam notificação com som, vibração e ação "Ver mapa"
                    </p>
                  )}

                  {/* ⏱ Cooldown — economia de requisições */}
                  {cooldownAte !== null && Date.now() < cooldownAte ? (
                    <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Economia ativa — sem eventos nos últimos 30km</span>
                        <span className="text-[8px] text-amber-400/60">
                          ({Math.ceil(((cooldownAte - Date.now()) / 60000))} min restantes)
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          // Cancela cooldown e força nova verificação
                          if (cooldownTimerRef.current) {
                            clearTimeout(cooldownTimerRef.current);
                            cooldownTimerRef.current = null;
                          }
                          setCooldownAte(null);
                          // Se notificação não permitida, tenta obter permissão
                          if (!notifPermitida && "Notification" in window && Notification.permission !== "denied") {
                            const ok = await solicitarPermissaoNotificacao();
                            setNotifPermitida(ok);
                          }
                          if (userPos) handleMonitorar(userPos[0], userPos[1]);
                        }}
                        className="shrink-0 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 underline transition-colors"
                      >
                        Forçar verificação
                      </button>
                    </div>
                  ) : (
                    userPos && (
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-500/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>
                          {analise?.eventos_analisados.some(ev => ev.distancia_km <= 30)
                            ? "Eventos próximos detectados — polling ativo"
                            : "Aguardando dados — sem cooldown"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Mensagem de Alerta */}
            {analise?.mensagem_alerta && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`mt-4 glass-subtle rounded-xl p-4 border ${analise.risco_geral_usuario > 80 ? "border-rose-500/30" : "border-border/50"}`}
              >
                <div className="flex items-start gap-3">
                  {analise.risco_geral_usuario > 80 ? (
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {analise.risco_geral_usuario > 80 ? "Alerta de Risco" : "Situação sob controle"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {analise.mensagem_alerta}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
          </TagDemo>

          {/* ── Gráfico de Tendência de Risco + Previsão ── */}
          <TagDemo texto="Gráfico interativo com histórico de risco e previsão para as próximas 6 horas">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Tendência e Previsão de Risco</h2>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  últimas {historicoRisco.length}h
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMostrarPrevisao(!mostrarPrevisao)}
                  className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${mostrarPrevisao ? "bg-indigo-500/20 text-indigo-400" : "text-muted-foreground"}`}
                >
                  <TrendingUp className="h-3 w-3" />
                  Previsão
                </button>
                <button
                  onClick={() => setChartExpandido(!chartExpandido)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <motion.div animate={{ rotate: chartExpandido ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4" />
                  </motion.div>
                </button>
              </div>
            </div>

            {/* SVG Chart — zero dependências externas */}
            <div className={chartExpandido ? "" : "max-h-[200px] overflow-hidden"}>
              {historicoRisco.length > 0 ? (
                <SvgLineChart
                  data={historicoRisco}
                  forecast={mostrarPrevisao ? previsaoRisco : []}
                  height={chartExpandido ? 300 : 180}
                  threshold={80}
                />
              ) : (
                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                  Faça uma análise para gerar o gráfico
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded bg-[#6366f1]" />
                <span>Risco</span>
              </div>
              {mostrarPrevisao && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded" style={{ background: "#a78bfa", borderTop: "1px dashed #a78bfa" }} />
                  <span>Previsão</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded bg-[#ef4444]" style={{ borderTop: "1px dashed #ef4444" }} />
                <span>Alerta 80%</span>
              </div>
            </div>
          </motion.div>
          </TagDemo>

          {/* ── Previsão de Chuva — Próximas 6h ── */}
          <TagDemo texto="Gráfico de previsão de precipitação e probabilidade de chuva para as próximas 6 horas">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Previsão de Chuva</h2>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  {precipitacaoHoraria.mm.length > 0 ? `próximas ${precipitacaoHoraria.mm.length}h` : "Open-Meteo"}
                </span>
              </div>
              <button
                onClick={() => setPrecipChartExpandido(!precipChartExpandido)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <motion.div animate={{ rotate: precipChartExpandido ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
            </div>

            <div className={precipChartExpandido ? "" : "max-h-[200px] overflow-hidden"}>
              {precipitacaoHoraria.mm.length > 0 ? (
                <SvgPrecipChart
                  precipitacao={precipitacaoHoraria.mm}
                  probabilidade={precipitacaoHoraria.prob}
                  codigos={precipitacaoHoraria.codigos}
                  height={precipChartExpandido ? 280 : 180}
                />
              ) : (
                <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "Carregando previsão..." : "Faça uma análise para ver a previsão de chuva"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-indigo-500/80 to-indigo-500/30" />
                <span>Precipitação (mm)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded bg-cyan-400" />
                <span>Probabilidade (%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-rose-500/80 to-rose-500/30" />
                <span>Forte/Severa</span>
              </div>
            </div>
          </motion.div>
          </TagDemo>

          {/* ── Histórico de Chuva — Últimas 24h ── */}
          <TagDemo texto="Gráfico de barras mostrando o acumulado de precipitação nas últimas 24 horas">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Histórico de Chuva</h2>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  {precip24h.mm.length > 0 ? `24h · ${precip24h.horarios.length}h registros` : "Open-Meteo"}
                </span>
              </div>
              <button
                onClick={() => setPrecipHistExpandido(!precipHistExpandido)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <motion.div animate={{ rotate: precipHistExpandido ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
            </div>

            <div className={precipHistExpandido ? "" : "max-h-[160px] overflow-hidden"}>
              {precip24h.mm.length > 0 ? (
                <SvgPrecipHistChart
                  precipitacao={precip24h.mm}
                  horarios={precip24h.horarios}
                  height={precipHistExpandido ? 240 : 150}
                />
              ) : (
                <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                  {loading ? "Carregando histórico..." : "Faça uma análise para ver o histórico de chuva"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-indigo-500/50" />
                <span>0.1 – 5.0 mm/h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-500/50" />
                <span>5.1 – 25.0 mm/h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#ef444480]" />
                <span>{'>'}25 mm/h</span>
              </div>
            </div>
          </motion.div>
          </TagDemo>

          {/* ── AI Insights Panel (aparece após análise) ── */}
          <AnimatePresence>
            {insightsAbertos && analise && (
              <TagDemo texto="Análise inteligente com resumo executivo, previsão, nível de confiança e recomendações baseadas em IA">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card rounded-2xl p-6 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />                      <h3 className="text-sm font-semibold">AI Insights — Análise de Risco</h3>
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                            : "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                      }`} />
                      {modeloLLM}
                      <span
                        title="O risco é calculado com base na severidade do evento (1-5) × fator de distância (0.1-1.0) × 1.2. Quanto mais próximo e severo, maior o %. Fontes: USGS, EMSC, GDACS, NASA FIRMS, Cemaden, Open-Meteo, NOAA Tsunami, USGS Volcano, OpenFEMA."
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted/50 text-[8px] cursor-help"
                      >?
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={() => setInsightsAbertos(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Resumo Executivo — LLM */}
                  <div className="glass-subtle rounded-xl p-4 md:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Resumo Executivo</p>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {analiseLLM?.resumo_executivo || (
                        <strong>Risco geral: {analise.risco_geral_usuario.toFixed(0)}% ({analise.nivel_alerta.toUpperCase()}).
                        {analise.eventos_analisados.length} eventos detectados.</strong>
                      )}
                    </p>
                    {/* Badge de fontes ativas */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[10px] text-muted-foreground">Fontes:</span>
                      {fontesAtivas.length > 0 ? fontesAtivas.map((f) => (
                        <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {f}
                        </span>
                      )) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Simulação local
                        </span>
                      )}
                    </div>

                    {/* Debug: mostrar se é LLM real ou fallback */}
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">IA:</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                      }`}>
                        <span
                          className={`rounded-full animate-pulse ${
                            modeloLLM.includes("[Cache]")
                              ? "bg-yellow-400"
                              : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                                ? "bg-emerald-400"
                                : "bg-sky-400"
                          }`}
                          style={{ width: "6px", height: "6px", display: "inline-block" }}
                        />
                        <span className={`${
                          modeloLLM.includes("[Cache]")
                            ? "text-yellow-400"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                              ? "text-emerald-400"
                              : "text-sky-400"
                        }`}>
                          {modeloLLM.includes("[Cache]") ? "🟡 Groq"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? "🟢 IA Real"
                            : "🔵 Fallback local"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Previsão */}
                  <div className="glass-subtle rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                      Previsão (próximas 6h)
                    </p>
                    {previsaoRisco.length > 0 && (
                      <>
                        <p className="text-2xl font-bold">
                          {previsaoRisco[previsaoRisco.length - 1]?.risco_previsto ?? "?"}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Tendência: {analiseLLM?.tendencia === "aumentando" ? "aumentando 📈" : analiseLLM?.tendencia === "diminuindo" ? "diminuindo 📉" : "estabilizando 📊"}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Confiança */}
                  <div className="glass-subtle rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      <BrainCircuit className="h-3 w-3 inline mr-1" />
                      Confiança da Análise
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${analiseLLM?.nivel_confianca === "alta" ? "bg-emerald-400" : analiseLLM?.nivel_confianca === "media" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                      <span className="text-sm font-medium capitalize">
                        {analiseLLM?.nivel_confianca || "N/A"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {fontesAtivas.length >= 2
                        ? "Múltiplas fontes cruzadas"
                        : fontesAtivas.length === 1
                          ? "Fonte única"
                          : "Apenas simulação"}
                    </p>
                  </div>

                  {/* Recomendações — LLM */}
                  <div className="glass-subtle rounded-xl p-4 md:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      <ShieldAlert className="h-3 w-3 inline mr-1" />
                      Recomendações
                    </p>
                    {analiseLLM?.recomendacoes && analiseLLM.recomendacoes.length > 0 ? (
                      <ul className="space-y-1.5">
                        {analiseLLM.recomendacoes.slice(0, 4).map((rec, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary shrink-0 mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {analise.risco_geral_usuario > 80 ? "🚨 Evacuação Imediata!" : "✅ Nenhuma ação imediata necessária."}
                      </p>
                    )}
                  </div>

                  {/* Análise Detalhada — LLM */}
                  {analiseLLM?.analise_detalhada && (
                    <div className="glass-subtle rounded-xl p-4 md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Análise Detalhada</p>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {analiseLLM.analise_detalhada}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/50">
                        <span>Modelo: {modeloLLM}</span>
                        {fontesAtivas.length > 0 && <span>· Fontes: {fontesAtivas.join(", ")}</span>}
                        {modeloLLM.includes("fallback") && (
                          <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px]">
                            ⚠️ Fallback (Zod não validou)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
              </TagDemo>
            )}
          </AnimatePresence>

          {/* ── Notícias Globais agrupadas por catástrofe ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Notícias Globais</h2>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  {noticias.length} eventos
                </span>
              </div>
              <button
                onClick={() => setNoticiasExpandidas(!noticiasExpandidas)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <motion.div animate={{ rotate: noticiasExpandidas ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
            </div>

            <div className={noticiasExpandidas ? "" : "max-h-[400px] overflow-hidden"}>
              <div className="space-y-2">
                {CATEGORIAS_NOTICIAS.map((cat) => {
                  const eventosDoTipo = noticias
                    .filter(n => n.tipo === cat.tipo)
                    .sort((a, b) => b.severidade - a.severidade);
                  const temEventos = eventosDoTipo.length > 0;
                  const expandido = categoriasExpandidas[cat.tipo] ?? true;
                  const maxItens = expandido ? 15 : 5;

                  return (
                    <div key={cat.tipo} className="glass-subtle rounded-xl overflow-hidden">
                      {/* Header da categoria */}
                      <button
                        onClick={() => setCategoriasExpandidas(prev => ({ ...prev, [cat.tipo]: !expandido }))}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.icone}</span>
                          <span className="text-sm font-semibold capitalize">{cat.tipo}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            temEventos
                              ? "bg-indigo-500/15 text-indigo-400"
                              : "bg-muted/30 text-muted-foreground"
                          }`}>
                            {temEventos ? eventosDoTipo.length : "0"}
                          </span>
                        </div>
                        <motion.div animate={{ rotate: expandido ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className={`h-3.5 w-3.5 ${temEventos ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
                        </motion.div>
                      </button>

                      {/* Eventos da categoria */}
                      {temEventos ? (
                        <div className="divide-y divide-border/10 border-t border-border/10">
                          {eventosDoTipo.slice(0, maxItens).map((noticia) => (
                            <div key={noticia.id} className="py-2.5 px-3 flex items-start gap-2.5">
                              <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                                noticia.severidade >= 4 ? "bg-rose-500/15" :
                                noticia.severidade >= 3 ? "bg-amber-500/15" :
                                "bg-emerald-500/15"
                              }`}>
                                {cat.icone}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium truncate">{noticia.titulo}</p>
                                  <div className={`shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded ${
                                    noticia.severidade >= 4 ? "bg-rose-500/15 text-rose-400" :
                                    noticia.severidade >= 3 ? "bg-amber-500/15 text-amber-400" :
                                    "bg-emerald-500/15 text-emerald-400"
                                  }`}>
                                    {noticia.severidade}/5
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{noticia.resumo}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {noticia.fonte_url ? (
                                    <a
                                      href={noticia.fonte_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary underline transition-colors"
                                    >
                                      <ExternalLink className="h-2.5 w-2.5" />
                                      Fonte
                                    </a>
                                  ) : (
                                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                                  )}
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {noticia.pais} · {tempoRelativo(noticia.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {eventosDoTipo.length > maxItens && (
                            <button
                              onClick={() => setCategoriasExpandidas(prev => ({ ...prev, [cat.tipo]: !expandido }))}
                              className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-2 text-center"
                            >
                              {expandido ? "Mostrar menos" : `+${eventosDoTipo.length - maxItens} mais`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 pb-2.5 border-t border-border/10">
                          <p className="text-[10px] text-muted-foreground/40 py-2 text-center italic">
                            {cat.tipo === "furacão" || cat.tipo === "tufão" || cat.tipo === "ciclone"
                              ? "🌀 Sem evento ativo"
                              : "Sem atividade registrada"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {!noticiasExpandidas && (
              <button
                onClick={() => setNoticiasExpandidas(true)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 text-center mt-2"
              >
                Expandir todas as categorias
              </button>
            )}
          </motion.div>

          {/* ── Content Grid: Eventos + Mapa ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Eventos List */}
            <TagDemo texto="Lista de eventos de risco próximos à sua localização, com análise da IA e recomendações de ação">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {analise && analise.eventos_analisados.length > 0 ? (
                <div className="glass-card rounded-2xl p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Eventos Próximos
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                        {analise.eventos_analisados.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setEventosExpandidos(!eventosExpandidos)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <motion.div animate={{ rotate: eventosExpandidos ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="h-4 w-4" />
                      </motion.div>
                    </button>
                  </div>

                  {analise.eventos_analisados.slice(0, eventosExpandidos ? undefined : 1).map((ev) => (
                    <motion.div
                      key={ev.id}
                      layout
                      className={`glass-subtle rounded-xl p-4 mb-3 border ${ev.impacto_percentual > 80 ? "border-rose-500/30" : ev.impacto_percentual > 60 ? "border-orange-500/30" : ev.impacto_percentual > 30 ? "border-amber-500/30" : "border-emerald-500/30"}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tipoIcone(ev.tipo)}</span>
                          <div>
                            <p className="text-sm font-medium capitalize">{ev.tipo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Severidade {ev.severidade}/5 · {ev.distancia_km.toFixed(0)} km
                            </p>
                          </div>
                        </div>
                        <div className={`text-right ${ev.impacto_percentual > 80 ? "text-rose-400" : ev.impacto_percentual > 60 ? "text-orange-400" : ev.impacto_percentual > 30 ? "text-amber-400" : "text-emerald-400"}`}>
                          <p className="text-lg font-bold">{ev.impacto_percentual.toFixed(0)}%</p>
                        </div>
                      </div>

                      <div className="glass-subtle rounded-lg p-3 mt-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Análise da IA
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                          {ev.analise_llm}
                        </p>
                      </div>

                      {/* Badge: Fonte + Distância do incidente até sua localização */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Fonte */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <ExternalLink className="h-2.5 w-2.5" />
                          {extrairFonte(ev.id) || "Simulação"}
                        </span>
                        {/* Distância do ponto de origem do incidente até você */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Navigation className="h-2.5 w-2.5" />
                          {ev.distancia_km.toFixed(0)} km da sua localização
                        </span>
                        {/* Impacto */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          ev.impacto_percentual > 80
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : ev.impacto_percentual > 60
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Impacto {ev.impacto_percentual.toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex items-start gap-2 mt-3">
                        <ShieldAlert className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{ev.recomendacao}</p>
                      </div>
                    </motion.div>
                  ))}

                  {analise.eventos_analisados.length > 1 && !eventosExpandidos && (
                    <button
                      onClick={() => setEventosExpandidos(true)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 text-center"
                    >
                      +{analise.eventos_analisados.length - 1} eventos ocultos
                    </button>
                  )}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center min-h-[400px]">
                  <Radar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    {loading ? "Analisando riscos próximos..." : "Compartilhe sua localização para iniciar."}
                  </p>
                  {loading && (
                    <div className="flex gap-1.5 mt-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
            </TagDemo>

            {/* Map */}
            <TagDemo texto="Mapa interativo mostrando sua localização e os eventos de risco ao redor do mundo">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-2xl overflow-hidden relative"
              style={{ minHeight: 460 }}
            >
              <div className="px-3 pt-3 pb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  🟢 Sua posição · Círculo de {raioBusca} km
                </span>
              </div>

              <MapContainer
                center={userPos || [-14.235, -51.9253]}
                zoom={userPos ? 10 : 4}
                className="w-full z-0"
                style={{ height: 400 }}
              >
                <MapController
                  centro={centroMapa}
                  eventos={[]}
                  userPos={userPos}
                />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* User marker */}
                {userPos && (
                  <Marker position={userPos} icon={userIcon}>
                    <Popup>
                      <div className="text-sm font-medium px-1">
                        Sua localização
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Raio de busca — círculo ao redor do usuário */}
                {userPos && (
                  <SafeCircle center={userPos} radius={raioBusca * 1000} />
                )}
              </MapContainer>

              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 z-[1000] glass-subtle rounded-lg px-3 py-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1] border border-white" />
                  <span>Você</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-0.5 rounded border-t-2 border-dashed border-indigo-500/50" style={{ borderTop: "2px dashed #6366f180" }} />
                  <span>Raio {raioBusca} km</span>
                </div>
              </div>

              {/* Placeholder */}
              {!userPos && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                  <div className="glass-subtle rounded-2xl px-6 py-4 text-center max-w-[260px]">
                    <MapPin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground/60">
                      Compartilhe sua localização para visualizar sua posição no mapa
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
            </TagDemo>
          </div>

          {/* ── 🌍 Mapa Mundial: Eventos Globais ── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl overflow-hidden relative"
            style={{ minHeight: 520 }}
          >
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Mapa Mundial</h2>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                  Eventos reais
                </span>
              </div>
              <button
                onClick={() => setMapaMundialExpandido(!mapaMundialExpandido)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <motion.div animate={{ rotate: mapaMundialExpandido ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </button>
            </div>

            {/* Filtro por tipo de evento */}
            <div className="px-3 pb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mr-1">Filtrar:</span>
              <button
                onClick={() => setFiltroTipos(new Set())}
                className={`text-[9px] px-2 py-1 rounded-full transition-colors ${filtroTipos.size === 0 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-muted/30 text-muted-foreground border border-transparent hover:border-muted-foreground/30'}`}
              >
                Todos
              </button>
              {TODOS_TIPOS_MAPA.map(({ tipo, icone }) => {
                const ativo = filtroTipos.size === 0 || filtroTipos.has(tipo);
                return (
                  <button
                    key={tipo}
                    onClick={() => {
                      const novo = new Set(filtroTipos);
                      if (novo.has(tipo)) novo.delete(tipo);
                      else novo.add(tipo);
                      if (novo.size === 0) setFiltroTipos(new Set());
                      else setFiltroTipos(novo);
                    }}
                    className={`text-[9px] px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                      ativo
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                        : 'bg-muted/20 text-muted-foreground/40 border border-transparent hover:border-muted-foreground/20'
                    }`}
                  >
                    <span>{icone}</span>
                    <span className="capitalize">{tipo}</span>
                  </button>
                );
              })}
              {analise && (
                <span className="text-[9px] text-muted-foreground/50 ml-auto">
                  {eventosMundiaisFiltrados.length}/{eventosMundiaisComLatLon.length}
                </span>
              )}
            </div>

            <div className={mapaMundialExpandido ? "" : "max-h-[440px] overflow-hidden"}>
              <MapContainer
                center={[0, 0]}
                zoom={2}
                className="w-full z-0"
                style={{ height: 400, minHeight: 400 }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Event markers (filtrados — sem coordenadas 0,0) */}
                {eventosMundiaisFiltrados.length > 0 && eventosMundiaisFiltrados.map((ev) => (
                  <Marker
                    key={ev.id}
                    position={[ev.lat, ev.lon]}
                    icon={criarIconeEvento(ev.tipo, ev.severidade)}
                  >
                    <Popup>
                      <div className="min-w-[200px] px-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{tipoIcone(ev.tipo)}</span>
                          <span className="font-medium text-sm capitalize">{ev.tipo}</span>
                          <span className="text-[10px] text-muted-foreground">sev {ev.severidade}/5</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {ev.distancia_km.toFixed(0)} km de distância
                        </p>
                        <p className="text-xs font-semibold">
                          Impacto: {ev.impacto_percentual.toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {ev.recomendacao}
                        </p>
                        {/* Fonte badge no popup */}
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            🟢 {extrairFonte(ev.id) || "API"}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 z-[1000] glass-subtle rounded-lg px-3 py-2 text-[10px] text-muted-foreground">
              <p className="text-[9px] font-medium mb-1 uppercase tracking-wider">Legenda</p>
              {TODOS_TIPOS_MAPA.slice(0, 6).map(({ tipo, icone, cor }) => (
                <div key={tipo} className="flex items-center gap-2 mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: cor, border: "1px solid rgba(255,255,255,0.5)" }} />
                  <span>{icone} {tipo}</span>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {(!analise || eventosMundiaisFiltrados.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                <div className="glass-subtle rounded-2xl px-6 py-4 text-center max-w-[280px]">
                  <Globe className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground/60">
                    {loading ? "Carregando eventos mundiais..." : "Faça uma análise para visualizar eventos globais no mapa"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-6 px-4 mt-6">
        <div className="max-w-6xl mx-auto glass-subtle rounded-2xl px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 SentinelaGlobal</span>
          <span className="hidden sm:block">
            Dados: USGS · GDACS · Cemaden · Open-Meteo · Groq LLM {fontesAtivas.length > 0 && `(${fontesAtivas.join(" · ")})`}
          </span>
          <a
            href="https://freebuff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            freebuff.com
          </a>
        </div>
      </footer>
    </motion.div>
  );
}
