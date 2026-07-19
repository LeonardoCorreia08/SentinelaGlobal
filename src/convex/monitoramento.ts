/**
 * src/convex/monitoramento.ts
 *
 * Módulo de monitoramento de riscos do SentinelaGlobal.
 * Substitui a lógica do FastAPI (tools/monitor.py) por funções Convex.
 *
 * Funcionalidades:
 *   - calcularRisco: análise de risco baseada na localização do usuário
 *   - salvarAlerta: persiste alertas críticos no banco
 *   - statusAlerta: retorna o alerta ativo mais recente
 *   - historicoRisco: retorna histórico de risco para gráficos
 */

import { mutation, query } from "./_generated/server";
import { v, type Infer } from "convex/values";

// ═════════════════════════════════════════════════════════════════════
//  EVENTOS_BASE — 12 eventos simulados por região do Brasil
// ═════════════════════════════════════════════════════════════════════

interface Evento {
  id: string;
  tipo: string;
  severidade: number;
  lat: number;
  lon: number;
  regiao: string;
  descricao: string;
  fonte: string;
}

const EVENTOS_BASE: Evento[] = [
  { id: "e001", tipo: "enchente", severidade: 4, lat: -23.5505, lon: -46.6333, regiao: "São Paulo, SP", descricao: "Enchente histórica na Marginal Tietê — transbordamento do Rio Tietê afeta vias expressas e bairros da Zona Norte.", fonte: "USGS / Cemaden" },
  { id: "e002", tipo: "deslizamento", severidade: 3, lat: -23.5628, lon: -46.6547, regiao: "São Paulo, SP", descricao: "Deslizamento de encosta em área de risco na Zona Sul após chuvas intensas de 120mm em 24h.", fonte: "Defesa Civil SP" },
  { id: "e003", tipo: "tempestade", severidade: 3, lat: -22.9068, lon: -43.1729, regiao: "Rio de Janeiro, RJ", descricao: "Tempestade severa com ventos de até 90 km/h e granizo em partes da Zona Sul e Grande Tijuca.", fonte: "INMET / NOAA" },
  { id: "e004", tipo: "deslizamento", severidade: 5, lat: -22.9314, lon: -43.2813, regiao: "Rio de Janeiro, RJ", descricao: "Deslizamento crítico na Rocinha — solo saturado após 5 dias consecutivos de chuva. Risco iminente de novas quedas.", fonte: "USGS / Geo-Rio" },
  { id: "e005", tipo: "enchente", severidade: 2, lat: -19.9167, lon: -43.9345, regiao: "Belo Horizonte, MG", descricao: "Alagamento em vias expressas do centro. Córregos transbordaram com 60mm de chuva em 2h.", fonte: "Defesa Civil MG" },
  { id: "e006", tipo: "ciclone", severidade: 4, lat: -29.9547, lon: -51.0808, regiao: "Porto Alegre, RS", descricao: "Ciclone extratropical categoría 2 com risco severo de inundação costeira e ressaca no Lago Guaíba.", fonte: "NOAA / Metsul" },
  { id: "e007", tipo: "enchente", severidade: 5, lat: -29.7845, lon: -51.1472, regiao: "Porto Alegre, RS", descricao: "Enchente severa no Lago Guaíba — nível ultrapassou 3,5m. Bairros inteiros submersos na Zona Sul.", fonte: "USGS / Defesa Civil RS" },
  { id: "e008", tipo: "seca", severidade: 3, lat: -8.0578, lon: -34.8829, regiao: "Recife, PE", descricao: "Estiagem prolongada (120 dias sem chuva) afetando abastecimento de água em bairros periféricos.", fonte: "ANA / INMET" },
  { id: "e009", tipo: "tempestade", severidade: 4, lat: -12.9714, lon: -38.5014, regiao: "Salvador, BA", descricao: "Tempestade tropical com volume de 150mm em 24h — alagamentos generalizados e deslizamentos pontuais.", fonte: "NOAA / INMET" },
  { id: "e010", tipo: "enchente", severidade: 3, lat: -3.119, lon: -60.0217, regiao: "Manaus, AM", descricao: "Enchente do Rio Negro — nível 2m acima da cota de alerta, comunidades ribeirinhas afetadas.", fonte: "USGS / CPRM" },
  { id: "e011", tipo: "queimada", severidade: 4, lat: -15.7939, lon: -47.8828, regiao: "Brasília, DF", descricao: "Queimadas no Parque Nacional de Brasília — fumaça encobre o Plano Piloto, visibilidade reduzida.", fonte: "INPE / Prevfogo" },
  { id: "e012", tipo: "tempestade", severidade: 2, lat: -15.5989, lon: -56.0979, regiao: "Cuiabá, MT", descricao: "Tempestade isolada com rajadas de 60km/h e queda de energia em bairros da região central.", fonte: "INMET" },
];

// ═════════════════════════════════════════════════════════════════════
//  FUNÇÕES MATEMÁTICAS (Haversine + Impacto)
// ═════════════════════════════════════════════════════════════════════

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcularImpacto(severidade: number, distanciaKm: number): number {
  const riscoBase = severidade * 20;
  let fatorDistancia: number;
  if (distanciaKm <= 5) fatorDistancia = 1.0;
  else if (distanciaKm <= 50) fatorDistancia = 0.7;
  else if (distanciaKm <= 100) fatorDistancia = 0.5;
  else if (distanciaKm <= 200) fatorDistancia = 0.25;
  else fatorDistancia = 0.1;
  return Math.min(riscoBase * fatorDistancia * 1.2, 100);
}

function nivelParaString(risco: number): string {
  if (risco <= 30) return "baixo";
  if (risco <= 60) return "moderado";
  if (risco <= 70) return "alto";
  return "critico";
}

function gerarAnalise(evento: EventoComDistancia): string {
  const { tipo, severidade, distancia_km, impacto_percentual, descricao } = evento;
  const nivel = impacto_percentual > 70 ? "crítico" : impacto_percentual > 60 ? "alto" : impacto_percentual > 30 ? "moderado" : "baixo";
  return `Risco ${nivel} (${impacto_percentual.toFixed(1)}%) — ${tipo} de severidade ${severidade}/5 a ${distancia_km.toFixed(0)} km de distância. ${descricao}. Fator de distância aplicado: ${distancia_km <= 5 ? "1.0 (crítico)" : distancia_km <= 50 ? "0.7 (alto)" : distancia_km <= 100 ? "0.5 (médio)" : distancia_km <= 200 ? "0.25 (baixo)" : "0.1 (mínimo)"}. Risco calculado: severidade × 20 × fator_distância × 1.2 = ${impacto_percentual.toFixed(0)}%.`;
}

function gerarRecomendacao(impacto: number, tipo: string): string {
  if (impacto > 70) return `🚨 EVACUAÇÃO IMEDIATA! ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} crítico a menos de 50 km. Abrigue-se em local seguro e siga as instruções da Defesa Civil.`;
  if (impacto > 60) return `⚠️ Risco alto. Prepare-se para possível evacuação. Mantenha documentos e kit de emergência prontos.`;
  if (impacto > 30) return `👀 Monitore a situação. Fique atento a boletins meteorológicos e notificações da Defesa Civil.`;
  return `✅ Nenhuma ação imediata necessária. Apenas monitoramento passivo recomendado.`;
}

// ═════════════════════════════════════════════════════════════════════
//  TIPOS COMPARTILHADOS
// ═════════════════════════════════════════════════════════════════════

interface EventoComDistancia extends Evento {
  distancia_km: number;
  impacto_percentual: number;
  analise_llm: string;
  recomendacao: string;
}

interface RiscoResult {
  timestamp: string;
  local_usuario: { lat: number; lon: number; nome_local: string };
  risco_geral_usuario: number;
  eventos_analisados: EventoComDistancia[];
  mensagem_alerta: string;
  nivel_alerta: string;
}

// ═════════════════════════════════════════════════════════════════════
//  SCHEMAS DO CONVEX
// ═════════════════════════════════════════════════════════════════════

export const alertaRiscoSchema = {
  risco_geral: v.float64(),
  mensagem_alerta: v.string(),
  nivel_alerta: v.string(),
  evento_critico_id: v.optional(v.string()),
  evento_critico_tipo: v.optional(v.string()),
  evento_critico_distancia_km: v.optional(v.float64()),
  evento_critico_analise: v.optional(v.string()),
  evento_critico_recomendacao: v.optional(v.string()),
  timestamp_analise: v.string(),
  lat_usuario: v.float64(),
  lon_usuario: v.float64(),
};

export const historicoRiscoSchema = {
  risco_geral: v.float64(),
  nivel_alerta: v.string(),
  timestamp: v.string(),
  lat_usuario: v.float64(),
  lon_usuario: v.float64(),
};

// ═════════════════════════════════════════════════════════════════════
//  QUERIES
// ═════════════════════════════════════════════════════════════════════

/**
 * calcularRisco — Analisa riscos para uma localização do usuário.
 * Substitui o endpoint /api/monitorar do FastAPI.
 */
export const calcularRisco = query({
  args: {
    lat: v.float64(),
    lon: v.float64(),
    nome_local: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RiscoResult> => {
    const lat = args.lat;
    const lon = args.lon;
    const raioBusca = 300;

    // Filtra eventos próximos
    const eventosComDistancia: EventoComDistancia[] = EVENTOS_BASE
      .map((ev) => {
        const dist = haversineKm(lat, lon, ev.lat, ev.lon);
        return { ...ev, distancia_km: dist };
      })
      .filter((ev) => ev.distancia_km <= raioBusca)
      .map((ev) => {
        const impacto = calcularImpacto(ev.severidade, ev.distancia_km);
        return {
          ...ev,
          impacto_percentual: impacto,
          analise_llm: gerarAnalise(ev as EventoComDistancia),
          recomendacao: gerarRecomendacao(impacto, ev.tipo),
        };
      })
      .sort((a, b) => b.impacto_percentual - a.impacto_percentual);

    const riscoGeral = eventosComDistancia.length > 0
      ? eventosComDistancia[0].impacto_percentual
      : 0;

    // Gera mensagem de alerta
    let mensagemAlerta: string;
    if (eventosComDistancia.length === 0) {
      mensagemAlerta = "Nenhum evento de risco detectado num raio de 300 km. Situação tranquila.";
    } else if (riscoGeral > 70) {
      const ev = eventosComDistancia[0];
      mensagemAlerta = `⚠️ RISCO CRÍTICO: ${ev.tipo.toUpperCase()} a ${ev.distancia_km.toFixed(0)} km com severidade ${ev.severidade}/5. Risco de ${riscoGeral.toFixed(0)}%. ${ev.recomendacao}`;
    } else if (riscoGeral > 60) {
      mensagemAlerta = `⚠️ Risco alto: ${eventosComDistancia[0].tipo} a ${eventosComDistancia[0].distancia_km.toFixed(0)} km. Risco de ${riscoGeral.toFixed(0)}%.`;
    } else if (riscoGeral > 30) {
      mensagemAlerta = `👀 Risco moderado: ${eventosComDistancia[0].tipo} a ${eventosComDistancia[0].distancia_km.toFixed(0)} km. Risco de ${riscoGeral.toFixed(0)}%. Monitore a situação.`;
    } else {
      mensagemAlerta = `✅ Risco baixo (${riscoGeral.toFixed(0)}%). Nenhuma ameaça significativa próxima.`;
    }

    return {
      timestamp: new Date().toISOString(),
      local_usuario: { lat, lon, nome_local: args.nome_local || "Não informado" },
      risco_geral_usuario: Math.round(riscoGeral * 10) / 10,
      eventos_analisados: eventosComDistancia,
      mensagem_alerta: mensagemAlerta,
      nivel_alerta: nivelParaString(riscoGeral),
    };
  },
});

/**
 * statusAlerta — Retorna o alerta ativo mais recente (risco > 70%).
 * Substitui o endpoint /api/status_alerta do FastAPI.
 */
export const statusAlerta = query({
  args: {},
  handler: async (ctx) => {
    const alerta = await ctx.db
      .query("alertas_risco")
      .order("desc")
      .first();

    if (!alerta) {
      return {
        alerta_ativo: false,
        risco_geral: null,
        mensagem_alerta: null,
        evento_critico: null,
        timestamp_analise: null,
        background_ativo: true,
      };
    }

    const isAtivo = alerta.risco_geral > 70;

    return {
      alerta_ativo: isAtivo,
      risco_geral: alerta.risco_geral,
      mensagem_alerta: alerta.mensagem_alerta,
      evento_critico: alerta.evento_critico_id ? {
        id: alerta.evento_critico_id,
        tipo: alerta.evento_critico_tipo || "desconhecido",
        severidade: 0,
        distancia_km: alerta.evento_critico_distancia_km || 0,
        impacto_percentual: alerta.risco_geral,
        analise_llm: alerta.evento_critico_analise || "",
        recomendacao: alerta.evento_critico_recomendacao || "",
      } : null,
      timestamp_analise: alerta.timestamp_analise,
      background_ativo: true,
    };
  },
});

/**
 * historicoRisco — Retorna o histórico de riscos para o gráfico.
 */
export const historicoRisco = query({
  args: {},
  handler: async (ctx) => {
    const historico = await ctx.db
      .query("historico_risco")
      .order("desc")
      .take(30);

    return historico.reverse();
  },
});

// ═════════════════════════════════════════════════════════════════════
//  MUTATIONS
// ═════════════════════════════════════════════════════════════════════

/**
 * salvarAlerta — Persiste um alerta crítico (risco > 70%) no banco.
 * Também salva no histórico para o gráfico de tendência.
 */
export const salvarAlerta = mutation({
  args: {
    risco_geral: v.float64(),
    mensagem_alerta: v.string(),
    nivel_alerta: v.string(),
    evento_critico_id: v.optional(v.string()),
    evento_critico_tipo: v.optional(v.string()),
    evento_critico_distancia_km: v.optional(v.float64()),
    evento_critico_analise: v.optional(v.string()),
    evento_critico_recomendacao: v.optional(v.string()),
    timestamp_analise: v.string(),
    lat_usuario: v.float64(),
    lon_usuario: v.float64(),
  },
  handler: async (ctx, args) => {
    // Salva alerta
    await ctx.db.insert("alertas_risco", {
      risco_geral: args.risco_geral,
      mensagem_alerta: args.mensagem_alerta,
      nivel_alerta: args.nivel_alerta,
      evento_critico_id: args.evento_critico_id,
      evento_critico_tipo: args.evento_critico_tipo,
      evento_critico_distancia_km: args.evento_critico_distancia_km,
      evento_critico_analise: args.evento_critico_analise,
      evento_critico_recomendacao: args.evento_critico_recomendacao,
      timestamp_analise: args.timestamp_analise,
      lat_usuario: args.lat_usuario,
      lon_usuario: args.lon_usuario,
    });

    // Salva no histórico para o gráfico
    await ctx.db.insert("historico_risco", {
      risco_geral: args.risco_geral,
      nivel_alerta: args.nivel_alerta,
      timestamp: args.timestamp_analise,
      lat_usuario: args.lat_usuario,
      lon_usuario: args.lon_usuario,
    });

    return { success: true };
  },
});

/**
 * gerarHistoricoSimulado — Gera dados de histórico simulados
 * para popular o gráfico de tendência.
 */
export const gerarHistoricoSimulado = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pontos: { risco_geral: number; nivel_alerta: string; timestamp: string; lat_usuario: number; lon_usuario: number }[] = [];

    for (let i = 30; i >= 0; i--) {
      const data = new Date(now - i * 60 * 60 * 1000);
      // Simula uma tendência com senoide + ruído
      const tendencia = Math.sin(i / 15 * Math.PI) * 15 + 20;
      const ruido = (Math.random() - 0.5) * 10;
      const risco = Math.max(0, Math.min(100, Math.round(tendencia + ruido)));
      const nivel = nivelParaString(risco);

      pontos.push({
        risco_geral: risco,
        nivel_alerta: nivel,
        timestamp: data.toISOString(),
        lat_usuario: -23.5505,
        lon_usuario: -46.6333,
      });
    }

    for (const p of pontos) {
      await ctx.db.insert("historico_risco", p);
    }

    return { pontos_gerados: pontos.length };
  },
});
