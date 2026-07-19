/**
 * src/lib/risco-local.ts
 *
 * Módulo de cálculo de risco SentinelaGlobal.
 * Agora com eventos GLOBAIS, previsão de risco (regressão linear)
 * e análise em estilo LLM (com fallback quando API não disponível).
 */

// ═════════════════════════════════════════════════════════════════════
//  TIPOS

// ═════════════════════════════════════════════════════════════════════
//  TIPOS
// ═════════════════════════════════════════════════════════════════════

export interface EventoAnalisado {
  id: string;
  tipo: string;
  severidade: number;
  distancia_km: number;
  impacto_percentual: number;
  analise_llm: string;
  recomendacao: string;
  /** Coordenadas reais do evento (da API original) */
  lat: number;
  lon: number;
  /** Nome da fonte de dados */
  fonte?: string;
}

export interface RiscoResult {
  timestamp: string;
  local_usuario: { lat: number; lon: number; nome_local: string };
  risco_geral_usuario: number;
  eventos_analisados: EventoAnalisado[];
  mensagem_alerta: string;
  nivel_alerta: "baixo" | "moderado" | "alto" | "critico";
}

export interface StatusAlerta {
  alerta_ativo: boolean;
  risco_geral: number | null;
  mensagem_alerta: string | null;
  evento_critico: EventoAnalisado | null;
  timestamp_analise: string | null;
  background_ativo: boolean;
}

export interface PontoHistorico {
  risco_geral: number;
  nivel_alerta: string;
  timestamp: string;
}

export interface PontoPrevisao {
  risco_previsto: number;
  timestamp: string;
}

export interface NoticiaGlobal {
  id: string;
  titulo: string;
  resumo: string;
  tipo: string;
  pais: string;
  severidade: number;
  timestamp: string;
  fonte_url?: string; // Link para a fonte original quando disponível
}

// ═════════════════════════════════════════════════════════════════════
//  FUNÇÕES MATEMÁTICAS
// ═════════════════════════════════════════════════════════════════════

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

function calcularImpacto(severidade: number, distanciaKm: number): number {
  const riscoBase = severidade * 20;
  let fatorDistancia: number;
  if (distanciaKm <= 5) fatorDistancia = 1.0;
  else if (distanciaKm <= 50) fatorDistancia = 0.7;
  else if (distanciaKm <= 100) fatorDistancia = 0.5;
  else if (distanciaKm <= 200) fatorDistancia = 0.25;
  else fatorDistancia = 0.1;
  return Math.round(Math.min(riscoBase * fatorDistancia * 1.2, 100) * 10) / 10;
}

export function nivelParaString(risco: number): "baixo" | "moderado" | "alto" | "critico" {
  if (risco <= 30) return "baixo";
  if (risco <= 60) return "moderado";
  if (risco <= 80) return "alto";
  return "critico";
}

// ═════════════════════════════════════════════════════════════════════
//  ANÁLISE EM ESTILO LLM (simulada — sem dependência de API externa)
// ═════════════════════════════════════════════════════════════════════

const PERFIS_ANALISE: Record<string, string> = {
  furacão: "O Centro Nacional de Furacões emitiu alerta máximo. A convecção profunda e o olho bem definido indicam um sistema em rápida intensificação. A trajetória projetada coloca áreas densamente povoadas na rota do olho.",
  tornado: "Imagens de radar mostram assinatura clara de debris ball e hook echo. O storm chase reporta danos estruturais consistentes com ventos de EF4. A supercélula mantém rotação mesociclônica intensa.",
  incêndio: "Imagens de satélite mostram pluma de fumaça se estendendo por mais de 100 km. As condições de temperatura, umidade relativa baixa e ventos fortes criam comportamento extremo do fogo com spotting a longa distância.",
  enchente: "Dados de estações pluviométricas indicam acumulado de 150mm+ em 6 horas. O solo já saturado não permite infiltração adicional. Modelos hidrológicos projetam pico de cheia nas próximas 6 horas.",
  terremoto: "O USGS reporta magnitude com mecanismo focal de falha reversa. A profundidade rasa (10 km) intensifica a sacudida do solo. Modelos de intensidade sísmica indicam potencial de liquefação em áreas costeiras.",
  ciclone: "Imagens de satélite no infravermelho mostram topos de nuvens extremamente frios (-80°C). O olho do ciclone contraiu-se, indicando parede do olho dupla. Intensificação rápida projetada nas próximas 24h.",
  tufão: "O JTWC classifica como super tufão com ventos sustentados de 260 km/h. O campo de vento se estende por 500 km de diâmetro. A crista subtropical ao norte está guiando o sistema para oeste-noroeste.",
  deslizamento: "Dados de satélite InSAR mostram deformação do terreno. O solo saturado, combinado com declividade >30°, cria condições ideais para fluxo de detritos. Pluviometria acumulada ativou alertas geotécnicos.",
  tempestade: "Análise sinótica mostra cavado de ondas curtas intensificando-se. Lifted Index de -6K indica instabilidade severa. CAPE acima de 3000 J/kg com cisalhamento de 40 nós favorece tempestades organizadas.",
  seca: "O índice de seca SPEI mostra condição severa a extrema. A anomalia de precipitação dos últimos 3 meses é de -60% da média histórica. Reservatórios operam com menos de 20% da capacidade.",
  nevasca: "Blizzard conditions com visibilidade <100m e ventos de 70 km/h. O gradiente de pressão de 20 hPa entre baixa costeira e alta continental força queda de neve com taxa de 5cm/h.",
  onda_calor: "Uma crista de alta pressão em bloqueio está gerando uma cúpula de calor. Temperaturas de 10-15°C acima da média histórica. O índice de calor ultrapassa 50°C, representando risco letal.",
  monção: "A corrente de jato de baixos níveis está transportando umidade da baía de Bengala. A convergência de umidade na escarpa dos Gates Ocidentais gera precipitação orográfica extrema de mais de 500mm/48h.",
  queimada: "O INPE detecta 3500 focos de calor ativos via satélite AQUA. A pluma de fumaça se estende por 800 km, afetando a qualidade do ar em múltiplos estados.",
  vulcão: "O VAAC reporta pluma de cinzas a 10 km de altitude. O índice VEI estimado em 3-4. A deformação do edifício vulcânico medida por GPS indica influxo magmático contínuo.",
};

function gerarAnaliseLLM(
  tipo: string,
  severidade: number,
  distancia_km: number,
  impacto_percentual: number,
  descricao: string,
  pais: string,
  regiao: string,
): string {
  const perfil = PERFIS_ANALISE[tipo] || `Alertas de ${tipo} foram emitidos pelas autoridades locais.`;
  const nivel = impacto_percentual > 80 ? "crítico" : impacto_percentual > 60 ? "alto" : impacto_percentual > 30 ? "moderado" : "baixo";

  const analisesContexto: Record<string, string> = {
    critico: `RISCO CRÍTICO (${impacto_percentual.toFixed(0)}%). Distância de ${distancia_km.toFixed(0)} km com severidade ${severidade}/5. ${perfil} Exige evacuação imediata e ativação de protocolos de emergência.`,
    alto: `Risco alto (${impacto_percentual.toFixed(0)}%). Evento a ${distancia_km.toFixed(0)} km com severidade ${severidade}/5. ${perfil} Recomenda-se preparação para evacuação e monitoramento contínuo.`,
    moderado: `Risco moderado (${impacto_percentual.toFixed(0)}%). ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de severidade ${severidade}/5 a ${distancia_km.toFixed(0)} km. ${perfil} Monitoramento ativo recomendado.`,
    baixo: `Risco baixo (${impacto_percentual.toFixed(0)}%). ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de severidade ${severidade}/5 a ${distancia_km.toFixed(0)} km. ${descricao} Apenas monitoramento passivo necessário.`,
  };

  return `📊 Análise em ${pais} — ${regiao}\n${analisesContexto[nivel]}`;
}

function gerarRecomendacaoLLM(impacto: number, tipo: string, pais: string): string {
  if (impacto > 80) return `🚨 EVACUAÇÃO IMEDIATA em ${pais}! ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} crítico. Siga as instruções das autoridades locais e dirija-se a abrigos designados.`;
  if (impacto > 60) return `⚠️ ${pais}: Prepare-se para evacuação. Mantenha documentos, medicamentos e kit de emergência prontos. Acompanhe os canais oficiais.`;
  if (impacto > 30) return `👀 ${pais}: Monitore boletins meteorológicos e defesa civil. Evite áreas de risco e mantenha-se informado.`;
  return `✅ ${pais}: Nenhuma ação imediata. Situação estável, apenas monitoramento de rotina.`;
}

// ═════════════════════════════════════════════════════════════════════
//  PREVISÃO DE RISCO (FORECAST) — Regressão Linear Simples
// ═════════════════════════════════════════════════════════════════════

export function calcularPrevisaoRisco(
  historico: PontoHistorico[],
  passosFuturos: number = 6,
): PontoPrevisao[] {
  if (historico.length < 3) {
    // Dados insuficientes para previsão
    const base = historico.length > 0 ? historico[historico.length - 1].risco_geral : 30;
    return Array.from({ length: passosFuturos }, (_, i) => ({
      risco_previsto: Math.round(base + (Math.random() - 0.5) * 10),
      timestamp: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString(),
    }));
  }

  // Regressão linear simples: y = a + bx
  const pontos = historico.slice(-15); // Últimos 15 pontos
  const n = pontos.length;
  const indices = pontos.map((_, i) => i);

  const sumX = indices.reduce((s, x) => s + x, 0);
  const sumY = pontos.reduce((s, p) => s + p.risco_geral, 0);
  const sumXY = indices.reduce((s, x, i) => s + x * pontos[i].risco_geral, 0);
  const sumX2 = indices.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const ultimoTimestamp = new Date(historico[historico.length - 1].timestamp);

  return Array.from({ length: passosFuturos }, (_, i) => {
    const idx = n + i;
    const valorBruto = intercept + slope * idx;
    const valorLimitado = Math.max(0, Math.min(100, Math.round(valorBruto)));
    const timestamp = new Date(ultimoTimestamp.getTime() + (i + 1) * 60 * 60 * 1000);
    return {
      risco_previsto: valorLimitado,
      timestamp: timestamp.toISOString(),
    };
  });
}


// ═════════════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL — calcularRiscoLocal (com suporte a dados reais externos)
// ═════════════════════════════════════════════════════════════════════

/**
 * Calcula risco para uma localização.
 *
 * @param eventosExternos — Eventos de fontes REAIS (USGS, GDACS, Cemaden)
 *   que serão mesclados com EVENTOS_GLOBAIS simulados.
 *   Eventos reais têm prioridade: entram com peso maior e substituem simulados próximos.
 */
export function calcularRiscoLocal(
  lat: number,
  lon: number,
  nomeLocal?: string,
  eventosExternos?: Array<{
    id: string;
    tipo: string;
    severidade: number;
    lat: number;
    lon: number;
    descricao: string;
    pais: string;
    regiao: string;
    fonte: string;
  }>,
  raioBusca: number = 300,
): RiscoResult {

  // APENAS dados reais — sem fallback simulado
  const eventosParaAnalisar: Array<{
    id: string;
    tipo: string;
    severidade: number;
    lat: number;
    lon: number;
    regiao: string;
    pais: string;
    descricao: string;
  }> = (eventosExternos || []).map((r) => ({
    id: r.id,
    tipo: r.tipo,
    severidade: Math.min(5, r.severidade + 0.5),
    lat: r.lat,
    lon: r.lon,
    regiao: r.regiao || r.pais,
    pais: r.pais || "Desconhecido",
    descricao: r.descricao,
  }));

  const eventosComDistancia = eventosParaAnalisar
    .map((ev) => ({ ...ev, distancia_km: haversineKm(lat, lon, ev.lat, ev.lon) }))
    .filter((ev) => ev.distancia_km <= raioBusca)
    .map((ev) => {
      const impacto = calcularImpacto(ev.severidade, ev.distancia_km);
      // Se o evento for de fonte real, marca na análise
      const fontePrefix = ev.id.startsWith("usgs_") ? "USGS" : ev.id.startsWith("gdacs_") ? "GDACS" : ev.id.startsWith("cemaden_") ? "Cemaden" : null;
      const analise = gerarAnaliseLLM(ev.tipo, ev.severidade, ev.distancia_km, impacto, ev.descricao, ev.pais, ev.regiao);
      return {
        id: ev.id,
        tipo: ev.tipo,
        severidade: ev.severidade,
        distancia_km: ev.distancia_km,
        impacto_percentual: impacto,
        analise_llm: fontePrefix ? `${analise}\n🔗 Fonte real: ${fontePrefix}` : analise,
        recomendacao: gerarRecomendacaoLLM(impacto, ev.tipo, ev.pais),
        lat: ev.lat,
        lon: ev.lon,
        fonte: fontePrefix || undefined,
      };
    })
    .sort((a, b) => b.impacto_percentual - a.impacto_percentual);

  const riscoGeral = eventosComDistancia.length > 0 ? eventosComDistancia[0].impacto_percentual : 0;

  let mensagemAlerta: string;
  if (eventosComDistancia.length === 0) {
    mensagemAlerta = `✅ Sem risco eminente. Nenhum evento detectado nas últimas 24h num raio de ${raioBusca} km.`;
  } else if (riscoGeral > 80) {
    const ev = eventosComDistancia[0];
    mensagemAlerta = `⚠️ RISCO CRÍTICO: ${ev.tipo.toUpperCase()} em ${ev.recomendacao.split("!")[0] || ""} a ${ev.distancia_km.toFixed(0)} km. Risco ${riscoGeral.toFixed(0)}%.`;
  } else if (riscoGeral > 60) {
    mensagemAlerta = `⚠️ Risco alto: ${eventosComDistancia[0].tipo} a ${eventosComDistancia[0].distancia_km.toFixed(0)} km. Risco ${riscoGeral.toFixed(0)}%.`;
  } else if (riscoGeral > 30) {
    mensagemAlerta = `👀 Risco moderado: ${eventosComDistancia[0].tipo} a ${eventosComDistancia[0].distancia_km.toFixed(0)} km. Monitore.`;
  } else {
    mensagemAlerta = `✅ Risco baixo (${riscoGeral.toFixed(0)}%). Nenhuma ameaça significativa.`;
  }

  return {
    timestamp: new Date().toISOString(),
    local_usuario: { lat, lon, nome_local: nomeLocal || "Não informado" },
    risco_geral_usuario: Math.round(riscoGeral * 10) / 10,
    eventos_analisados: eventosComDistancia,
    mensagem_alerta: mensagemAlerta,
    nivel_alerta: nivelParaString(riscoGeral),
  };
}


