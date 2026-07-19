/**
 * src/lib/alerta-chuva.ts
 *
 * Classificação de precipitação e alertas de chuva para o SentinelaGlobal.
 *
 * Fontes oficiais utilizadas:
 *   - INMET (Instituto Nacional de Meteorologia) — classificação de intensidade
 *   - CEMADEN (Centro Nacional de Monitoramento e Alertas de Desastres Naturais)
 *   - Open-Meteo — dados atuais e previsão (API gratuita, sem chave)
 *
 * Classificação de intensidade de chuva (INMET):
 *   Fraca:      0.1 – 5.0 mm/h
 *   Moderada:   5.1 – 25.0 mm/h
 *   Forte:     25.1 – 50.0 mm/h
 *   Severa:    50.1 – 100.0 mm/h  (≥ 50mm em 1h)
 *   Extrema:   > 100.0 mm/h       (≥ 100mm em 1h)
 *
 * Referência: INMET (https://www.inmet.gov.br) e CEMADEN (https://www.cemaden.gov.br)
 */

// ═════════════════════════════════════════════════════════════════════
//  TIPOS
// ═════════════════════════════════════════════════════════════════════

export type NivelChuva = "sem_chuva" | "fraca" | "moderada" | "forte" | "severa" | "extrema";

export interface ClassificacaoChuva {
  nivel: NivelChuva;
  label: string;
  cor: string;
  icone: string;
  mm_h: string;         // faixa em mm/h
  alerta: boolean;
  recomendacao: string;
  fonte: string;
}

export interface AlertaChuva {
  ativo: boolean;
  nivel: NivelChuva;
  precipitacao_atual_mm: number | null;
  precipitacao_diaria_mm: number | null;
  probabilidade_max: number | null;
  codigo_tempo: number | null;
  timestamps: {
    atual: string;
    previsao: string;
  };
  classificacao: ClassificacaoChuva;
  mensagem: string;
  fontes: string[];
}

// ═════════════════════════════════════════════════════════════════════
//  CLASSIFICAÇÃO POR INTENSIDADE (mm/h) — Padrão INMET
// ═════════════════════════════════════════════════════════════════════

export const CLASSIFICACOES_INMET: Record<NivelChuva, ClassificacaoChuva> = {
  sem_chuva: {
    nivel: "sem_chuva",
    label: "Sem chuva",
    cor: "text-emerald-400",
    icone: "☀️",
    mm_h: "0 mm/h",
    alerta: false,
    recomendacao: "Nenhuma ação necessária.",
    fonte: "INMET / Open-Meteo",
  },
  fraca: {
    nivel: "fraca",
    label: "Chuva fraca",
    cor: "text-blue-400",
    icone: "🌦️",
    mm_h: "0.1 – 5.0 mm/h",
    alerta: false,
    recomendacao: "Leve possibilidade de chuva. Sem riscos significativos.",
    fonte: "INMET / Open-Meteo",
  },
  moderada: {
    nivel: "moderada",
    label: "Chuva moderada",
    cor: "text-amber-400",
    icone: "🌧️",
    mm_h: "5.1 – 25.0 mm/h",
    alerta: false,
    recomendacao: "Chuva moderada. Evite áreas alagáveis e mantenha atenção a boletins.",
    fonte: "INMET / Open-Meteo",
  },
  forte: {
    nivel: "forte",
    label: "Chuva forte",
    cor: "text-orange-500",
    icone: "🌧️💨",
    mm_h: "25.1 – 50.0 mm/h",
    alerta: true,
    recomendacao: "⚠️ Chuva forte! Risco de alagamentos. Evite áreas de baixada e não atravesse ruas alagadas.",
    fonte: "INMET / CEMADEN",
  },
  severa: {
    nivel: "severa",
    label: "Chuva severa",
    cor: "text-rose-500",
    icone: "⛈️⚠️",
    mm_h: "50.1 – 100.0 mm/h",
    alerta: true,
    recomendacao: "🚨 ALERTA SEVERO! Risco de enchentes, deslizamentos e transbordamento de rios. Evacuação preventiva recomendada. Busque abrigo em local elevado.",
    fonte: "CEMADEN / INMET / Defesa Civil",
  },
  extrema: {
    nivel: "extrema",
    label: "Chuva extrema",
    cor: "text-red-600",
    icone: "🚨☔️",
    mm_h: "> 100.0 mm/h",
    alerta: true,
    recomendacao: "🆘 CHUVA EXTREMA! Perigo iminente de desastres. Evacuação imediata! Siga instruções da Defesa Civil e busque abrigo em local seguro e elevado.",
    fonte: "CEMADEN / INMET / Defesa Civil",
  },
};

// ═════════════════════════════════════════════════════════════════════
//  CLASSIFICAÇÃO POR CÓDIGO WMO (Open-Meteo / INMET)
// ═════════════════════════════════════════════════════════════════════

/**
 * Códigos WMO (World Meteorological Organization) para chuva.
 * Fonte: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
export const CODIGOS_CHUVA: Record<number, { nivel: NivelChuva; descricao: string }> = {
  0:   { nivel: "sem_chuva", descricao: "Céu limpo" },
  1:   { nivel: "sem_chuva", descricao: "Predominantemente limpo" },
  2:   { nivel: "sem_chuva", descricao: "Parcialmente nublado" },
  3:   { nivel: "sem_chuva", descricao: "Encoberto" },
  45:  { nivel: "sem_chuva", descricao: "Nevoeiro" },
  48:  { nivel: "sem_chuva", descricao: "Nevoeiro com geada" },
  51:  { nivel: "fraca", descricao: "Chuvisco leve" },
  53:  { nivel: "fraca", descricao: "Chuvisco moderado" },
  55:  { nivel: "moderada", descricao: "Chuvisco intenso" },
  56:  { nivel: "fraca", descricao: "Chuvisco congelante leve" },
  57:  { nivel: "moderada", descricao: "Chuvisco congelante intenso" },
  61:  { nivel: "fraca", descricao: "Chuva fraca (leve)" },
  63:  { nivel: "moderada", descricao: "Chuva moderada" },
  65:  { nivel: "forte", descricao: "Chuva forte (intensa)" },
  66:  { nivel: "fraca", descricao: "Chuva congelante leve" },
  67:  { nivel: "moderada", descricao: "Chuva congelante intensa" },
  80:  { nivel: "fraca", descricao: "Pancadas de chuva fracas" },
  81:  { nivel: "moderada", descricao: "Pancadas de chuva moderadas" },
  82:  { nivel: "forte", descricao: "Pancadas de chuva fortes/violentas" },
  95:  { nivel: "forte", descricao: "Tempestade fraca ou moderada" },
  96:  { nivel: "severa", descricao: "Tempestade com granizo fraco" },
  99:  { nivel: "severa", descricao: "Tempestade com granizo forte" },
};

// ═════════════════════════════════════════════════════════════════════
//  FUNÇÕES DE CLASSIFICAÇÃO
// ═════════════════════════════════════════════════════════════════════

/**
 * Classifica a intensidade da precipitação com base nos padrões do INMET.
 * @param mmPorHora - Precipitação atual em mm/h
 * @returns NivelChuva (sem_chuva | fraca | moderada | forte | severa | extrema)
 */
export function classificarPorIntensidade(mmPorHora: number | null): NivelChuva {
  if (mmPorHora === null || mmPorHora <= 0) return "sem_chuva";
  if (mmPorHora <= 5.0) return "fraca";
  if (mmPorHora <= 25.0) return "moderada";
  if (mmPorHora <= 50.0) return "forte";
  if (mmPorHora <= 100.0) return "severa";
  return "extrema";
}

/**
 * Classifica o tempo pelo código WMO.
 * @param codigoWMO - Código WMO de tempo (0-99)
 * @returns NivelChuva correspondente
 */
export function classificarPorCodigoWMO(codigoWMO: number | null): NivelChuva {
  if (codigoWMO === null) return "sem_chuva";
  return CODIGOS_CHUVA[codigoWMO]?.nivel ?? "sem_chuva";
}

/**
 * Retorna a classificação combinada (intensidade + código WMO).
 * Usa o mais severo entre os dois.
 */
export function classificarCombinado(
  mmPorHora: number | null,
  codigoWMO: number | null,
): NivelChuva {
  const porIntensidade = classificarPorIntensidade(mmPorHora);
  const porCodigo = classificarPorCodigoWMO(codigoWMO);

  const ordem: NivelChuva[] = ["sem_chuva", "fraca", "moderada", "forte", "severa", "extrema"];
  const idxIntensidade = ordem.indexOf(porIntensidade);
  const idxCodigo = ordem.indexOf(porCodigo);

  return idxIntensidade >= idxCodigo ? porIntensidade : porCodigo;
}

/**
 * Retorna o objeto ClassificacaoChuva completo para um nível.
 */
export function getClassificacao(nivel: NivelChuva): ClassificacaoChuva {
  return CLASSIFICACOES_INMET[nivel];
}

// ═════════════════════════════════════════════════════════════════════
//  FUNÇÃO PRINCIPAL — Gerar Alerta de Chuva
// ═════════════════════════════════════════════════════════════════════

/**
 * Gera um alerta de chuva completo baseado nos dados meteorológicos atuais.
 *
 * @param precipitacaoAtualMm - Precipitação atual em mm
 * @param precipitacaoDiariaMm - Precipitação acumulada no dia em mm
 * @param probabilidadeMax - Probabilidade máxima de precipitação (%)
 * @param codigoTempo - Código WMO atual
 * @param codigoTempoDiario - Código WMO diário
 * @param fontesAtivas - Lista de fontes meteorológicas ativas
 * @returns AlertaChuva completo
 */
export function gerarAlertaChuva(
  precipitacaoAtualMm: number | null,
  precipitacaoDiariaMm: number | null,
  probabilidadeMax: number | null,
  codigoTempo: number | null,
  codigoTempoDiario: number | null,
  fontesAtivas: string[] = [],
): AlertaChuva {
  const nivel = classificarCombinado(precipitacaoAtualMm, codigoTempo);
  const classificacao = getClassificacao(nivel);

  // Constrói mensagem de alerta
  let mensagem: string;
  const agora = new Date().toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (nivel === "sem_chuva" || nivel === "fraca") {
    if (probabilidadeMax && probabilidadeMax > 50) {
      mensagem = `🌤️ ${probabilidadeMax}% de chance de chuva nas próximas horas. ${classificacao.recomendacao}`;
    } else {
      mensagem = `☀️ Sem chuva no momento (${agora}). ${classificacao.recomendacao}`;
    }
  } else {
    const partes: string[] = [];
    if (precipitacaoAtualMm !== null && precipitacaoAtualMm > 0) {
      partes.push(`${precipitacaoAtualMm.toFixed(1)} mm/h agora`);
    }
    if (precipitacaoDiariaMm !== null && precipitacaoDiariaMm > 0) {
      partes.push(`${precipitacaoDiariaMm.toFixed(1)} mm acumulado no dia`);
    }
    if (probabilidadeMax !== null && probabilidadeMax > 30) {
      partes.push(`${probabilidadeMax}% de chance de mais chuva`);
    }
    mensagem = `${classificacao.icone} ${classificacao.label} — ${partes.join(" · ")}`;
    if (nivel === "forte" || nivel === "severa" || nivel === "extrema") {
      mensagem += `\n⚠️ ${classificacao.recomendacao}`;
    }
  }

  // Determina fontes do alerta
  const fontes = [...new Set([
    ...fontesAtivas.filter(f => ["Open-Meteo", "INMET", "CEMADEN"].includes(f)),
    "INMET",
  ])];

  return {
    ativo: nivel === "forte" || nivel === "severa" || nivel === "extrema",
    nivel,
    precipitacao_atual_mm: precipitacaoAtualMm,
    precipitacao_diaria_mm: precipitacaoDiariaMm,
    probabilidade_max: probabilidadeMax,
    codigo_tempo: codigoTempo,
    timestamps: {
      atual: new Date().toISOString(),
      previsao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    classificacao,
    mensagem,
    fontes,
  };
}

// ═════════════════════════════════════════════════════════════════════
//  CONSTANTES EXPOSTAS
// ═════════════════════════════════════════════════════════════════════

export const FONTES_CHUVA = [
  {
    nome: "INMET",
    descricao: "Instituto Nacional de Meteorologia — Dados oficiais de estações automáticas",
    url: "https://www.inmet.gov.br",
    tipo: "governo federal",
  },
  {
    nome: "CEMADEN",
    descricao: "Centro Nacional de Monitoramento e Alertas de Desastres Naturais — Rede de pluviômetros",
    url: "https://www.cemaden.gov.br",
    tipo: "governo federal",
  },
  {
    nome: "ANA",
    descricao: "Agência Nacional de Águas — Dados hidrológicos e pluviométricos",
    url: "https://www.gov.br/ana",
    tipo: "governo federal",
  },
  {
    nome: "Open-Meteo",
    descricao: "API meteorológica gratuita — Dados de modelos globais (ECMWF, GFS)",
    url: "https://open-meteo.com",
    tipo: "privada / open source",
  },
] as const;
