import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  SearchX,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix Leaflet default marker icon (Vite bundler workaround) ────────
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// Custom user marker icon (blue dot)
const userIcon = L.divIcon({
  className: "bg-transparent",
  html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

import logo from "@/assets/logo.svg";

// ── Fallback faculty database (mirrors tools/scraper.py) ────────────────
const FACULDADES_BASE: Record<string, {
  nome: string;
  mensalidade: number | null;
  curso: string;
  localidade: string;
  lat: number;
  lng: number;
}> = {
  usp: { nome: "Universidade de São Paulo (USP)", mensalidade: null, curso: "Engenharia de Computação", localidade: "São Paulo, SP", lat: -23.561, lng: -46.7309 },
  unicamp: { nome: "Universidade Estadual de Campinas (UNICAMP)", mensalidade: null, curso: "Medicina", localidade: "Campinas, SP", lat: -22.8269, lng: -47.0718 },
  fgv: { nome: "Fundação Getulio Vargas (FGV)", mensalidade: 5500, curso: "Administração de Empresas", localidade: "São Paulo, SP", lat: -23.5679, lng: -46.6475 },
  "puc-sp": { nome: "Pontifícia Universidade Católica de São Paulo (PUC-SP)", mensalidade: 4200, curso: "Direito", localidade: "São Paulo, SP", lat: -23.5587, lng: -46.6605 },
  "puc-rj": { nome: "Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)", mensalidade: 4800, curso: "Ciência da Computação", localidade: "Rio de Janeiro, RJ", lat: -22.9798, lng: -43.2345 },
  ufrj: { nome: "Universidade Federal do Rio de Janeiro (UFRJ)", mensalidade: null, curso: "Engenharia Civil", localidade: "Rio de Janeiro, RJ", lat: -22.8625, lng: -43.2234 },
  insper: { nome: "Insper Instituto de Ensino e Pesquisa", mensalidade: 5200, curso: "Engenharia Mecatrônica", localidade: "São Paulo, SP", lat: -23.5882, lng: -46.6836 },
  mackenzie: { nome: "Universidade Presbiteriana Mackenzie", mensalidade: 3800, curso: "Arquitetura e Urbanismo", localidade: "São Paulo, SP", lat: -23.5465, lng: -46.6505 },
};

function buscarFaculdadeFallback(query: string): {
  nome: string | null;
  mensalidade_estimada: number | null;
  latitude: number | null;
  longitude: number | null;
} | null {
  const q = query.toLowerCase().trim();
  // Busca exata primeiro
  if (FACULDADES_BASE[q]) {
    const f = FACULDADES_BASE[q];
    return { nome: f.nome, mensalidade_estimada: f.mensalidade, latitude: f.lat, longitude: f.lng };
  }
  // Busca parcial
  for (const [chave, dados] of Object.entries(FACULDADES_BASE)) {
    if (q.includes(chave) || chave.includes(q)) {
      return { nome: dados.nome, mensalidade_estimada: dados.mensalidade, latitude: dados.lat, longitude: dados.lng };
    }
  }
  // Busca por palavra
  const palavras = q.split(/\s+/);
  for (const palavra of palavras) {
    if (palavra.length < 3) continue;
    for (const [chave, dados] of Object.entries(FACULDADES_BASE)) {
      if (chave.includes(palavra) || palavra.includes(chave)) {
        return { nome: dados.nome, mensalidade_estimada: dados.mensalidade, latitude: dados.lat, longitude: dados.lng };
      }
    }
  }
  return null;
}

// ── MapController: child component that reliably uses useMap() ────────
function MapController({ posicao, userPos }: { posicao: { lat: number; lng: number } | null; userPos: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (posicao && !userPos) {
      map.flyTo([posicao.lat, posicao.lng], 14, { duration: 1.5 });
    } else if (posicao && userPos) {
      const bounds = L.latLngBounds(
        [userPos.lat, userPos.lng],
        [posicao.lat, posicao.lng]
      );
      map.fitBounds(bounds, { padding: [60, 60], duration: 1.2 });
    }
  }, [posicao, userPos, map]);

  return null;
}

// ── API response type ──────────────────────────────────────────────────
interface ConsultaResponse {
  recomendacao: string;
  justificativa: string;
  preco_estimado: number | null;
  latitude: number | null;
  longitude: number | null;
}

interface DistanciaResponse {
  distancia_km: number | null;
  faculdade_localizada: boolean;
  mensagem: string;
  lat_faculdade: number | null;
  lon_faculdade: number | null;
}

type EstadoConsulta =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ConsultaResponse }
  | { status: "error"; erro: string };

// ── Histórico ──────────────────────────────────────────────────────────
const STORAGE_KEY = "faculfinder_historico";

interface HistoricoItem {
  id: string;
  query: string;
  recomendacao: string;
  preco_estimado: number | null;
  distancia_km: number | null;
  timestamp: number;
}

function carregarHistorico(): HistoricoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoricoItem[]) : [];
  } catch {
    return [];
  }
}

function salvarHistorico(itens: HistoricoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itens));
  } catch {
    // localStorage cheio ou indisponível — ignora
  }
}

// ── Dashboard Component ────────────────────────────────────────────────
export default function Dashboard() {
  const [mensagem, setMensagem] = useState("");
  const [estado, setEstado] = useState<EstadoConsulta>({ status: "idle" });
  const [mapCenter] = useState<[number, number]>([-15.78, -47.93]); // Brasil central
  const [posicaoMapa, setPosicaoMapa] = useState<{ lat: number; lng: number; nome: string } | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [distancia, setDistancia] = useState<DistanciaResponse | null>(null);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>(carregarHistorico);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  async function handleConsultar(queryOverride?: string) {
    const query = (queryOverride ?? mensagem).trim();
    if (!query) return;
    setEstado({ status: "loading" });
    setPosicaoMapa(null);
    setUserPosition(null);
    setDistancia(null);
    setGeoError(null);

    try {
      const res = await fetch("/api/consultoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: query }),
      });

      if (!res.ok) {
        throw new Error(`Erro ${res.status}: ${res.statusText}`);
      }

      const data: ConsultaResponse = await res.json();
      setEstado({ status: "success", data });

      // Usa coordenadas REAIS vindas da API (buscar_dados_faculdade)
      if (data.latitude != null && data.longitude != null) {
        setPosicaoMapa({
          lat: data.latitude,
          lng: data.longitude,
          nome: data.recomendacao,
        });
      }

      // Salva no histórico (distância será atualizada depois se calculada)
      adicionarAoHistorico(query, data, null);
    } catch (err) {
      // Fallback local quando a API não está disponível
      const fallback = buscarFaculdadeFallback(query);
      if (fallback && fallback.nome) {
        const dataFallback: ConsultaResponse = {
          recomendacao: fallback.nome,
          justificativa: `Faculdade encontrada no banco de dados local. Mensalidade estimada: ${fallback.mensalidade_estimada === null || fallback.mensalidade_estimada === 0 ? "Gratuita (pública)" : `R$ ${fallback.mensalidade_estimada.toLocaleString("pt-BR")}/mês`}.`,
          preco_estimado: fallback.mensalidade_estimada,
          latitude: fallback.latitude,
          longitude: fallback.longitude,
        };
        setEstado({ status: "success", data: dataFallback });
        if (dataFallback.latitude != null && dataFallback.longitude != null) {
          setPosicaoMapa({
            lat: dataFallback.latitude,
            lng: dataFallback.longitude,
            nome: dataFallback.recomendacao,
          });
        }
        adicionarAoHistorico(query, dataFallback, null);
      } else {
        setEstado({
          status: "error",
          erro: err instanceof Error ? err.message : "Não foi possível encontrar a faculdade. Tente digitar o nome de uma faculdade como USP, FGV ou UNICAMP.",
        });
      }
    }
  }

  async function handleUsarLocalizacao() {
    if (!navigator.geolocation) {
      setGeoError("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    setCalculandoDistancia(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserPosition({ lat: userLat, lng: userLng });

        try {
          const res = await fetch("/api/distancia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat_usuario: userLat,
              lon_usuario: userLng,
              faculdade_nome: estado.status === "success" ? estado.data.recomendacao : "",
            }),
          });

          if (!res.ok) throw new Error(`Erro ${res.status}`);

          const data: DistanciaResponse = await res.json();
          setDistancia(data);

          // Atualiza a distância no histórico
          setHistorico((prev) => {
            const idx = prev.findIndex((i) => i.query === mensagem.trim());
            if (idx < 0) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], distancia_km: data.distancia_km };
            salvarHistorico(updated);
            return updated;
          });
          // O zoom no mapa é controlado automaticamente pelo MapController
        } catch (err) {
          setGeoError(err instanceof Error ? err.message : "Erro ao calcular distância");
        } finally {
          setCalculandoDistancia(false);
        }
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "Permissão de localização negada. Ative nas configurações do navegador."
            : "Não foi possível obter sua localização. Tente novamente."
        );
        setCalculandoDistancia(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function adicionarAoHistorico(query: string, data: ConsultaResponse, dist: number | null) {
    setHistorico((prev) => {
      // Evita duplicatas consecutivas
      if (prev.length > 0 && prev[0].query === query) return prev;
      const novo: HistoricoItem[] = [
        {
          id: crypto.randomUUID(),
          query,
          recomendacao: data.recomendacao,
          preco_estimado: data.preco_estimado,
          distancia_km: dist,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19), // máximo 20 itens
      ];
      salvarHistorico(novo);
      setHistoricoAberto(true);
      return novo;
    });
  }

  function handleLimparHistorico() {
    setHistorico([]);
    salvarHistorico([]);
  }

  const polylinePositions: [number, number][] | null =
    userPosition && posicaoMapa
      ? [
          [userPosition.lat, userPosition.lng],
          [posicaoMapa.lat, posicaoMapa.lng],
        ]
      : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col"
    >
      {/* ── Navigation ── */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-6xl">
        <nav className="glass-panel rounded-2xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" width={32} height={32} className="rounded-lg" />
            <span className="font-semibold text-sm tracking-tight">
              Facul<span className="gradient-text">Finder</span>
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Dashboard</span>
        </nav>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col px-4 pt-24 pb-8">
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6">
          {/* ── Consultor IA Input ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Consultor IA</h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                Groq + Llama 3
              </span>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConsultar();
                  }}
                  placeholder='Ex: "Quero Ciência de Dados em Paulista até 800 reais"'
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 pr-10 text-sm
                             placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                             transition-all duration-200"
                  disabled={estado.status === "loading"}
                />
                {estado.status === "loading" && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleConsultar()}
                disabled={estado.status === "loading" || !mensagem.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 py-3 text-sm font-medium
                           transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2 shrink-0"
              >
                Consultar
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {estado.status === "error" && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-sm text-red-400"
              >
                {estado.erro}
              </motion.p>
            )}
          </motion.div>

          {/* ── Histórico de Consultas ── */}
          {historico.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-subtle rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setHistoricoAberto(!historicoAberto)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-background/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Histórico de consultas</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                    {historico.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLimparHistorico();
                    }}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                    title="Limpar histórico"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <motion.div
                    animate={{ rotate: historicoAberto ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {historicoAberto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/40 divide-y divide-border/20 max-h-[280px] overflow-y-auto">
                      {historico.map((item) => (
                        <div
                          key={item.id}
                          className="px-5 py-3 hover:bg-background/20 transition-colors group cursor-pointer"
                          onClick={() => {
                            setMensagem(item.query);
                            setHistoricoAberto(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {item.query}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-primary font-medium truncate">
                                  {item.recomendacao}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  ·
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.preco_estimado === null || item.preco_estimado === 0
                                    ? "Gratuita"
                                    : `R$ ${item.preco_estimado.toLocaleString("pt-BR")}`}
                                </span>
                                {item.distancia_km != null && (
                                  <>
                                    <span className="text-[10px] text-muted-foreground">·</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.distancia_km.toFixed(1)} km
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMensagem(item.query);
                                  setHistoricoAberto(false);
                                  handleConsultar(item.query);
                                }}
                                className="text-muted-foreground hover:text-primary transition-colors p-1"
                                title="Reconsultar"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(item.timestamp).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Content Grid: Recommendation Card + Map ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommendation Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {estado.status === "success" ? (
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recomendação da IA
                    </span>
                  </div>

                  {/* Faculty name */}
                  <h3 className="text-2xl font-bold tracking-tight mb-1">
                    {estado.data.recomendacao || "Nenhuma"}
                  </h3>

                  {/* Price badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-subtle text-sm font-medium mb-4">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {estado.data.preco_estimado === null || estado.data.preco_estimado === 0 ? (
                      <span className="text-emerald-400">Gratuita (pública)</span>
                    ) : (
                      <span>R$ {estado.data.preco_estimado.toLocaleString("pt-BR")}/mês</span>
                    )}
                  </div>

                  {/* Location indicator */}
                  {estado.data.latitude != null && estado.data.longitude != null && (
                    <div className="glass-subtle rounded-lg px-3 py-1.5 mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      Coordenadas: {estado.data.latitude.toFixed(4)}, {estado.data.longitude.toFixed(4)}
                    </div>
                  )}

                  {/* Justification */}
                  <div className="glass-subtle rounded-xl p-4 mb-5 flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {estado.data.justificativa}
                    </p>
                  </div>

                  {/* Distance display */}
                  {distancia && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="glass-subtle rounded-xl p-3 mb-4 flex items-center gap-3"
                    >
                      <Navigation className={`h-5 w-5 shrink-0 ${distancia.faculdade_localizada ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-sm">
                        {distancia.distancia_km != null ? (
                          <>
                            <span className="font-semibold">{distancia.distancia_km.toFixed(1)} km</span>
                            <span className="text-muted-foreground"> de distância</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">{distancia.mensagem}</span>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {geoError && (
                    <p className="text-xs text-red-400 mb-4">{geoError}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    {/* View on Map button */}
                    <button
                      disabled={!posicaoMapa}
                      className="glass-button rounded-xl px-5 py-2.5 text-sm font-medium w-full flex items-center justify-center gap-2
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MapPin className="h-4 w-4" />
                      {posicaoMapa ? posicaoMapa.nome : "Localização indisponível"}
                    </button>

                    {/* Geolocation button */}
                    <button
                      onClick={handleUsarLocalizacao}
                      disabled={calculandoDistancia || !posicaoMapa}
                      className="glass-button rounded-xl px-5 py-2.5 text-sm font-medium w-full flex items-center justify-center gap-2
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {calculandoDistancia ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Calculando distância...
                        </>
                      ) : (
                        <>
                          <Crosshair className="h-4 w-4" />
                          Usar minha localização
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : estado.status === "loading" ? (
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center min-h-[420px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Analisando sua consulta...
                  </p>
                  <div className="flex gap-1.5 mt-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center min-h-[420px]">
                  <BrainCircuit className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Faça uma pergunta sobre faculdades para receber uma recomendação personalizada com IA.
                  </p>
                </div>
              )}
            </motion.div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-2xl overflow-hidden relative"
              style={{ minHeight: 420 }}
            >
              <MapContainer
                center={mapCenter}
                zoom={4}
                className="w-full z-0"
                style={{ height: 420 }}
              >
                <MapController posicao={posicaoMapa ? { lat: posicaoMapa.lat, lng: posicaoMapa.lng } : null} userPos={userPosition} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Faculty marker */}
                {posicaoMapa && (
                  <Marker position={[posicaoMapa.lat, posicaoMapa.lng]}>
                    <Popup>
                      <div className="font-medium text-sm px-1">
                        {posicaoMapa.nome}
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* User marker */}
                {userPosition && (
                  <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
                    <Popup>
                      <div className="text-sm px-1">
                        Sua localização
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* Distance polyline */}
                {polylinePositions && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                      color: "#6366f1",
                      weight: 2.5,
                      opacity: 0.7,
                      dashArray: "8 6",
                    }}
                  />
                )}
              </MapContainer>

              {/* Placeholder quando não há faculdade selecionada */}
              {!posicaoMapa && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[1000]">
                  <div className="glass-subtle rounded-2xl px-6 py-4 text-center max-w-[260px]">
                    <SearchX className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground/60">
                      {estado.status === "success"
                        ? "Faculdade sem coordenadas disponíveis"
                        : "Faça uma consulta para ver a localização"}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-6 px-4">
        <div className="max-w-6xl mx-auto glass-subtle rounded-2xl px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 FaculFinder</span>
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
