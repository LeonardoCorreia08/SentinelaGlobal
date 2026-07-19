"""
app/main.py

SentinelaGlobal — API de Monitoramento de Riscos com IA.

Utiliza Tool Calling (Groq + Llama 3) para atuar como Analista de Risco,
interpretando dados de desastres simulados (USGS/NOAA/Defesa Civil) e
calculando o nível de ameaça para a localização do usuário.

── Refinamentos de Qualidade Científica ──────────────────────────────
  • temperature=0.1 — precisão máxima com leve variação analítica
  • response_format={"type": "json_object"} — Structured Output
  • Few-shot examples no system prompt (enchente 200km vs 5km)
  • Chain-of-Thought explicando o cálculo do impacto
  • Background loop a cada 60s monitorando riscos continuamente
────────────────────────────────────────────────────────────────────────
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field

# ── Ferramentas locais ──────────────────────────────────────────────────────
from tools.monitor import calcular_risco_geral

# ── Configuração de logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sentinela-global")

# ── Configuração do LLM ─────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.3-70b-versatile"

if not GROQ_API_KEY:
    raise RuntimeError(
        "A variável de ambiente GROQ_API_KEY não foi definida. "
        "Obtenha sua chave gratuita em https://console.groq.com/"
    )

client = OpenAI(
    base_url=GROQ_BASE_URL,
    api_key=GROQ_API_KEY,
)

# ╔══════════════════════════════════════════════════════════════════════╗
# ║     SCHEMAS — Pydantic + JSON Schema (Structured Outputs)           ║
# ╚══════════════════════════════════════════════════════════════════════╝


class MonitorarRequest(BaseModel):
    """Payload de entrada — coordenadas do usuário a serem analisadas."""
    lat: float = Field(
        ...,
        ge=-90, le=90,
        description="Latitude do usuário em graus decimais.",
        example=-23.5505,
    )
    lon: float = Field(
        ...,
        ge=-180, le=180,
        description="Longitude do usuário em graus decimais.",
        example=-46.6333,
    )
    nome_local: Optional[str] = Field(
        None,
        description="Nome descritivo da localidade (cidade, bairro).",
        example="São Paulo, SP",
    )


class EventoAnalisado(BaseModel):
    """Evento de risco analisado pelo LLM."""
    id: str = Field(..., description="Identificador único do evento.")
    tipo: str = Field(..., description="Tipo de desastre (enchente, deslizamento, tempestade, etc.).")
    severidade: int = Field(..., ge=1, le=5, description="Severidade do evento (1=mínima, 5=crítica).")
    distancia_km: float = Field(..., ge=0, description="Distância do evento até o usuário em km.")
    impacto_percentual: float = Field(..., ge=0, le=100, description="Percentual de risco calculado (0-100).")
    analise_llm: str = Field(..., description="Explicação em linguagem natural do cálculo de impacto e análise de risco.")
    recomendacao: str = Field(..., description="Recomendação de ação para o usuário com base no risco.")


class MonitorarResponse(BaseModel):
    """Resposta estruturada da análise de risco."""
    timestamp: str = Field(..., description="Timestamp ISO da análise.")
    local_usuario: Dict[str, Any] = Field(..., description="Coordenadas e local do usuário analisado.")
    risco_geral_usuario: float = Field(..., ge=0, le=100, description="Percentual de risco geral do usuário (0-100).")
    eventos_analisados: List[EventoAnalisado] = Field(
        ..., description="Lista de eventos de risco próximos analisados pelo LLM."
    )
    mensagem_alerta: str = Field(
        ..., description="Mensagem de alerta resumida para exibição imediata ao usuário."
    )
    nivel_alerta: str = Field(
        ...,
        description="Nível de alerta: 'baixo' (0-30), 'moderado' (31-60), 'alto' (61-70), 'critico' (71-100).",
    )


class StatusAlertaResponse(BaseModel):
    """Resposta do endpoint de polling de status do alerta ativo."""
    alerta_ativo: bool = Field(..., description="Se há um alerta ativo no momento (risco > 70%).")
    risco_geral: Optional[float] = Field(None, description="Percentual de risco geral atual.")
    mensagem_alerta: Optional[str] = Field(None, description="Mensagem do alerta ativo.")
    evento_critico: Optional[Dict[str, Any]] = Field(None, description="Detalhes do evento crítico.")
    timestamp_analise: Optional[str] = Field(None, description="Timestamp da última análise.")
    background_ativo: bool = Field(..., description="Se o loop de monitoramento em background está rodando.")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     VARIÁVEIS GLOBAIS DE ESTADO                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝

# Última localização do usuário para o background loop
_ultima_localizacao: Dict[str, Any] | None = None

# Alerta ativo salvo em JSON (para o frontend ler via polling)
ALERTA_FILE = Path("alerta_ativo.json")

# Controle do background loop
_background_task: asyncio.Task | None = None
_background_ativo: bool = False


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     FUNÇÕES AUXILIARES                                             ║
# ╚══════════════════════════════════════════════════════════════════════╝


def _nivel_para_string(risco: float) -> str:
    """Converte um valor de risco (0-100) para o nível textual."""
    if risco <= 30:
        return "baixo"
    elif risco <= 60:
        return "moderado"
    elif risco <= 70:
        return "alto"
    else:
        return "critico"


def _salvar_alerta_json(dados: Dict[str, Any]) -> None:
    """Persiste o alerta ativo em alerta_ativo.json."""
    try:
        with open(ALERTA_FILE, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        logger.info("  ✓ Alerta salvo em %s", ALERTA_FILE)
    except Exception as exc:
        logger.error("  ✗ Falha ao salvar alerta: %s", exc)


def _carregar_alerta_json() -> Dict[str, Any]:
    """Carrega o alerta ativo de alerta_ativo.json."""
    if not ALERTA_FILE.exists():
        return {"alerta_ativo": False}
    try:
        with open(ALERTA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return {"alerta_ativo": False}


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     SYSTEM PROMPT — Analista de Risco com Few-Shot Examples        ║
# ╚══════════════════════════════════════════════════════════════════════╝

SYSTEM_PROMPT_ANALISTA = """Você é um Analista de Risco Sênior especializado em desastres naturais e monitoramento de ameaças. Sua função é analisar eventos de risco próximos à localização de um usuário e gerar um relatório JSON estruturado e preciso.

## REGRAS:
1. Responda **exclusivamente** com um JSON válido contendo os campos especificados.
2. Analise **cada evento** individualmente, calculando o impacto com base na distância e severidade.
3. Para cada evento, explique em `analise_llm` o raciocínio usado para classificar o risco.
4. O `risco_geral_usuario` deve refletir o maior risco entre todos os eventos.
5. A `mensagem_alerta` deve ser clara, direta e acionável para o usuário final.

## FEW-SHOT EXAMPLES — Como classificar corretamente:

### Exemplo 1: Risco BAIXO
- Evento: Enchente, Severidade 4 (Alta)
- Distância do usuário: 200 km
- Análise correta: "Risco baixo (10.5%) — apesar da severidade alta do evento (enchente categoria 4), a distância de 200 km reduz significativamente o impacto. O fator de distância para 200 km é 0.25, resultando em risco_base 80% × 0.25 × 1.2 = 24%, mas a distância real de 200km coloca o usuário fora da zona de perigo imediato. Apenas monitoramento passivo recomendado."

### Exemplo 2: Risco CRÍTICO
- Evento: Deslizamento, Severidade 5 (Crítica)
- Distância do usuário: 5 km
- Análise correta: "Risco crítico (100%) — severidade 5 (máxima) combinada com proximidade extrema de apenas 5 km gera risco imediato. Fator de distância 1.0 (≤5km) multiplicado pelo risco base de 100% (severidade × 20) com fator de segurança 1.2 resulta em 120%, limitado a 100%. EVACUAÇÃO IMEDIATA RECOMENDADA. O solo saturado e a topografia local agravam significativamente o perigo."

### Exemplo 3: Risco MODERADO
- Evento: Tempestade, Severidade 3 (Média)
- Distância do usuário: 75 km
- Análise correta: "Risco moderado (36%) — severidade 3 com distância de 75 km. Fator de distância 0.5 (entre 50-100km). Risco base 60% × 0.5 × 1.2 = 36%. Embora não represente perigo imediato, a tempestade pode se deslocar em direção ao usuário. Recomenda-se acompanhar boletins meteorológicos nas próximas horas."

## FORMATO DE SAÍDA (JSON):
{
  "risco_geral_usuario": <número 0-100>,
  "mensagem_alerta": "<texto>",
  "nivel_alerta": "<baixo|moderado|alto|critico>",
  "eventos_analisados": [
    {
      "id": "<id>",
      "tipo": "<tipo>",
      "severidade": <1-5>,
      "distancia_km": <número>,
      "impacto_percentual": <0-100>,
      "analise_llm": "<explicação detalhada do cálculo>",
      "recomendacao": "<ação recomendada>"
    }
  ]
}
"""


def _analisar_com_llm(
    user_location: Dict[str, Any],
    dados_risco: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Envia os dados das ferramentas ao LLM para atuar como Analista de Risco.

    Usa ``response_format=json_object`` e ``temperature=0.1`` para
    máxima precisão com leve variação analítica.

    Args:
        user_location: Coordenadas do usuário.
        dados_risco: Dicionário com ``eventos``, ``risco_geral``, ``evento_critico``
                     retornado por ``calcular_risco_geral``.

    Returns:
        Dicionário conforme o schema ``MonitorarResponse``.
    """
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║   SentinelaGlobal — Análise de Risco com IA             ║")
    logger.info("╠══════════════════════════════════════════════════════════╣")
    logger.info("║  Local: lat=%.4f, lon=%.4f", user_location.get("lat", 0), user_location.get("lon", 0))
    logger.info("║  Eventos detectados: %d", len(dados_risco.get("eventos", [])))
    logger.info("║  Risco geral (ferramenta): %.1f%%", dados_risco.get("risco_geral", 0))
    logger.info("╚══════════════════════════════════════════════════════════╝")
    logger.info("")
    logger.info("── Chain-of-Thought: LLM Analisando Riscos ──")
    logger.info("  • Modelo: %s", GROQ_MODEL)
    logger.info("  • temperature=0.1")
    logger.info("  • response_format=json_object")
    logger.info("  • Few-shot examples: enchente 200km (baixo), deslizamento 5km (crítico)")
    logger.info("")

    # Prepara dados para o LLM
    eventos_para_llm = []
    for ev in dados_risco.get("eventos", []):
        eventos_para_llm.append({
            "id": ev["id"],
            "tipo": ev["tipo"],
            "severidade": ev["severidade"],
            "distancia_km": ev["distancia_km"],
            "impacto_percentual_ferramenta": ev.get("impacto_percentual", 0),
            "regiao": ev["regiao"],
            "descricao": ev["descricao"],
        })

    payload_ferramentas = {
        "local_usuario": {
            "lat": user_location.get("lat"),
            "lon": user_location.get("lon"),
            "nome_local": user_location.get("nome_local", "Não informado"),
        },
        "risco_geral_calculado_ferramenta": dados_risco.get("risco_geral", 0),
        "eventos_proximos": eventos_para_llm,
        "instrucoes_analise": (
            "Analise cada evento individualmente. Para cada um, explique em 'analise_llm' "
            "o raciocínio completo: como a severidade combinada com a distância resulta no "
            "percentual de impacto. Use a fórmula: risco_base = severidade × 20, "
            "fator_distancia (≤5km=1.0, ≤50km=0.7, ≤100km=0.5, ≤200km=0.25, >200km=0.1), "
            "risco_final = min(risco_base × fator_distancia × 1.2, 100). "
            "Exiba seu Chain-of-Thought em cada analise_llm."
        ),
    }

    logger.info("── Dados enviados ao LLM (%d eventos) ──", len(eventos_para_llm))
    for ev in eventos_para_llm:
        logger.info(
            "  • %s (%s) | severidade=%d | dist=%.1fkm | impacto=%.1f%%",
            ev["id"], ev["tipo"], ev["severidade"],
            ev["distancia_km"], ev["impacto_percentual_ferramenta"],
        )

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALISTA},
                {
                    "role": "user",
                    "content": (
                        "Realize a análise de risco completa para este usuário.\n\n"
                        f"Dados das ferramentas:\n"
                        f"{json.dumps(payload_ferramentas, ensure_ascii=False, indent=2)}"
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=2048,
        )

        conteudo = completion.choices[0].message.content or "{}"
        logger.info("  ✓ Resposta do LLM recebida (%d caracteres)", len(conteudo))

        parsed = json.loads(conteudo)

        # Log detalhado da análise da IA
        logger.info("")
        logger.info("── Análise da IA (Chain-of-Thought) ──")
        logger.info("  • Risco geral: %.1f%% (%s)",
                     parsed.get("risco_geral_usuario", 0),
                     parsed.get("nivel_alerta", "desconhecido"))
        logger.info("  • Mensagem: %s", parsed.get("mensagem_alerta", "")[:120])
        logger.info("")
        for ev in parsed.get("eventos_analisados", []):
            logger.info("  ┌─ Evento %s ─────────────────────────────────", ev.get("id", "?"))
            logger.info("  │ Tipo:      %s", ev.get("tipo", "?"))
            logger.info("  │ Distância: %.1f km", ev.get("distancia_km", 0))
            logger.info("  │ Impacto:   %.1f%%", ev.get("impacto_percentual", 0))
            logger.info("  │ Análise:   %s", ev.get("analise_llm", "")[:150])
            logger.info("  │ Recom.:    %s", ev.get("recomendacao", "")[:100])
            logger.info("  └──────────────────────────────────────────────")

        return parsed

    except Exception as exc:
        logger.error("  ✗ Falha na análise do LLM: %s", exc, exc_info=True)
        # Fallback estruturado
        return {
            "risco_geral_usuario": dados_risco.get("risco_geral", 0),
            "mensagem_alerta": "Não foi possível realizar a análise completa com IA. Os dados das ferramentas indicam o risco calculado mecanicamente.",
            "nivel_alerta": _nivel_para_string(dados_risco.get("risco_geral", 0)),
            "eventos_analisados": [
                {
                    "id": ev["id"],
                    "tipo": ev["tipo"],
                    "severidade": ev["severidade"],
                    "distancia_km": ev["distancia_km"],
                    "impacto_percentual": ev.get("impacto_percentual", 0),
                    "analise_llm": f"Risco calculado pela ferramenta: severidade {ev['severidade']} × fator de distância. Distância: {ev['distancia_km']:.1f} km. Descrição: {ev['descricao'][:100]}",
                    "recomendacao": "Monitore a situação e mantenha-se informado sobre atualizações da Defesa Civil.",
                }
                for ev in dados_risco.get("eventos", [])
            ],
        }


def _executar_ciclo_monitoramento(
    localizacao: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Ciclo completo de monitoramento:

    1. Chama as ferramentas locais (verificar_riscos + calcular_impacto).
    2. Envia os dados ao LLM para análise como Analista de Risco.
    3. Se risco > 70%, persiste o alerta em alerta_ativo.json.
    4. Retorna a resposta estruturada.

    Args:
        localizacao: Dicionário com ``lat``, ``lon`` e opcional ``nome_local``.

    Returns:
        Dicionário completo conforme ``MonitorarResponse``.
    """
    logger.info("")
    logger.info("═" * 60)
    logger.info("  CICLO DE MONITORAMENTO — SentinelaGlobal")
    logger.info("═" * 60)

    # ── Passo 1: Ferramentas locais ───────────────────────────────────
    logger.info("")
    logger.info("── Passo 1: Verificando riscos com ferramentas locais ──")

    dados_risco = calcular_risco_geral(localizacao)
    logger.info("  • Eventos próximos detectados: %d", len(dados_risco["eventos"]))
    logger.info("  • Risco geral (ferramenta): %.1f%%", dados_risco["risco_geral"])

    for ev in dados_risco["eventos"]:
        logger.info(
            "    - %s | %s | severidade %d | dist=%.1fkm | impacto=%.1f%%",
            ev["id"], ev["tipo"], ev["severidade"],
            ev["distancia_km"], ev.get("impacto_percentual", 0),
        )

    # ── Passo 2: Análise do LLM ───────────────────────────────────────
    logger.info("")
    logger.info("── Passo 2: Analisando com LLM (Analista de Risco) ──")

    analise_llm = _analisar_com_llm(localizacao, dados_risco)

    # Monta resposta final
    timestamp = datetime.now().isoformat()
    resultado = {
        "timestamp": timestamp,
        "local_usuario": {
            "lat": localizacao.get("lat"),
            "lon": localizacao.get("lon"),
            "nome_local": localizacao.get("nome_local", "Não informado"),
        },
        "risco_geral_usuario": analise_llm.get("risco_geral_usuario", dados_risco["risco_geral"]),
        "eventos_analisados": analise_llm.get("eventos_analisados", []),
        "mensagem_alerta": analise_llm.get("mensagem_alerta", "Nenhum alerta no momento."),
        "nivel_alerta": analise_llm.get("nivel_alerta", _nivel_para_string(dados_risco["risco_geral"])),
    }

    # ── Passo 3: Se risco > 70%, salva alerta ─────────────────────────
    risco_geral = resultado["risco_geral_usuario"]
    logger.info("")
    logger.info("── Passo 3: Verificando limiar de alerta (>70%%) ──")
    logger.info("  • Risco geral: %.1f%%", risco_geral)

    if risco_geral > 70:
        logger.info("  ⚠ RISCO CRÍTICO! Salvando alerta ativo...")
        alerta_data = {
            "alerta_ativo": True,
            "risco_geral": risco_geral,
            "mensagem_alerta": resultado["mensagem_alerta"],
            "evento_critico": resultado["eventos_analisados"][0] if resultado["eventos_analisados"] else None,
            "timestamp_analise": timestamp,
        }
        _salvar_alerta_json(alerta_data)
    else:
        logger.info("  ℹ Risco abaixo do limiar. Nenhum alerta salvo.")
        # Se havia alerta anterior, limpa
        if ALERTA_FILE.exists():
            _salvar_alerta_json({"alerta_ativo": False})

    logger.info("")
    logger.info("═" * 60)
    logger.info("  CICLO FINALIZADO — Risco: %.1f%% (%s)", risco_geral, resultado["nivel_alerta"])
    logger.info("═" * 60)

    return resultado


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     BACKGROUND LOOP — Monitoramento Contínuo a Cada 60s            ║
# ╚══════════════════════════════════════════════════════════════════════╝


async def background_monitor_loop() -> None:
    """
    Loop de monitoramento em background que executa a cada 60 segundos.

    1. Pega a última localização salva do usuário.
    2. Chama o ciclo completo de monitoramento (ferramentas + LLM).
    3. Se risco > 70%, persiste o alerta em alerta_ativo.json.
    4. Loga detalhes do raciocínio (Chain-of-Thought) a cada execução.
    """
    global _background_ativo
    _background_ativo = True

    logger.info("")
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║   BACKGROUND MONITOR LOOP INICIADO (intervalo: 60s)    ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")

    while _background_ativo:
        global _ultima_localizacao

        try:
            if _ultima_localizacao is None:
                logger.info("  ℹ Nenhuma localização de usuário salva — aguardando...")
            else:
                logger.info("")
                logger.info("── [BG] Executando ciclo de monitoramento ──")
                logger.info("  • Localização: lat=%.4f, lon=%.4f",
                             _ultima_localizacao["lat"], _ultima_localizacao["lon"])

                _executar_ciclo_monitoramento(_ultima_localizacao)

            await asyncio.sleep(60)

        except asyncio.CancelledError:
            logger.info("  ℹ Background loop cancelado.")
            break
        except Exception as exc:
            logger.error("  ✗ Erro no background loop: %s", exc, exc_info=True)
            await asyncio.sleep(60)


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     FASTAPI APP                                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝

app = FastAPI(
    title="SentinelaGlobal — Monitoramento de Riscos com IA",
    description=(
        "API de monitoramento contínuo de desastres naturais que utiliza "
        "Tool Calling (Groq + Llama 3) para analisar riscos próximos à "
        "localização do usuário. Inclui background loop automático a cada "
        "60 segundos e geração de alertas críticos (risco > 70%)."
    ),
    version="2.0.0",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Inicia o background loop de monitoramento ao subir a aplicação."""
    global _background_task
    logger.info("")
    logger.info("╔══════════════════════════════════════════════════════════╗")
    logger.info("║   SentinelaGlobal — Sistema Iniciado                    ║")
    logger.info("╚══════════════════════════════════════════════════════════╝")
    _background_task = asyncio.create_task(background_monitor_loop())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Para o background loop ao desligar a aplicação."""
    global _background_ativo, _background_task
    _background_ativo = False
    if _background_task:
        _background_task.cancel()
        logger.info("  ℹ Background loop finalizado.")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║     ENDPOINTS                                                      ║
# ╚══════════════════════════════════════════════════════════════════════╝


@app.post(
    "/api/monitorar",
    response_model=MonitorarResponse,
    summary="Analisar riscos para localização do usuário",
    description=(
        "Recebe as coordenadas do usuário, consulta as ferramentas locais "
        "(verificar_riscos + calcular_impacto), envia os dados ao LLM "
        "(Analista de Risco) e retorna uma análise estruturada com "
        "eventos, risco geral e mensagem de alerta."
    ),
)
async def monitorar(request: MonitorarRequest) -> Dict[str, Any]:
    """
    Endpoint principal de monitoramento de riscos.

    Fluxo:
    1. Armazena a localização do usuário para o background loop.
    2. Executa o ciclo completo de monitoramento.
    3. Retorna a análise estruturada.
    """
    global _ultima_localizacao

    localizacao = {
        "lat": request.lat,
        "lon": request.lon,
        "nome_local": request.nome_local or "Não informado",
    }

    # Salva para o background loop usar
    _ultima_localizacao = localizacao

    logger.info("")
    logger.info("=" * 60)
    logger.info("NOVA ANÁLISE DE RISCO SOLICITADA")
    logger.info("  • Local: lat=%.4f, lon=%.4f", request.lat, request.lon)
    if request.nome_local:
        logger.info("  • Nome: %s", request.nome_local)
    logger.info("=" * 60)

    try:
        resultado = _executar_ciclo_monitoramento(localizacao)
        return resultado

    except Exception as exc:
        logger.critical("✗ ERRO NÃO TRATADO NO ENDPOINT: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=(
                "Erro inesperado ao analisar riscos. "
                "Verifique se a chave da API Groq está configurada "
                "corretamente e tente novamente."
            ),
        ) from exc


@app.get(
    "/api/status_alerta",
    response_model=StatusAlertaResponse,
    summary="Verificar status do alerta ativo",
    description=(
        "Endpoint de polling para o frontend. Retorna o alerta ativo "
        "salvo em alerta_ativo.json, se houver (risco > 70%% gerado "
        "pelo background loop ou pela última análise manual)."
    ),
)
async def status_alerta() -> Dict[str, Any]:
    """
    Retorna o status do alerta ativo para o frontend.

    O frontend faz polling a cada 5 segundos neste endpoint para
    detectar mudanças no nível de risco em tempo real.
    """
    alerta = _carregar_alerta_json()

    return {
        "alerta_ativo": alerta.get("alerta_ativo", False),
        "risco_geral": alerta.get("risco_geral"),
        "mensagem_alerta": alerta.get("mensagem_alerta"),
        "evento_critico": alerta.get("evento_critico"),
        "timestamp_analise": alerta.get("timestamp_analise"),
        "background_ativo": _background_ativo,
    }


# ── Health check ────────────────────────────────────────────────────────────

@app.get(
    "/health",
    summary="Health check",
    tags=["Infra"],
)
async def health() -> Dict[str, Any]:
    """Retorna o status da API e do background loop."""
    return {
        "status": "ok",
        "servico": "SentinelaGlobal",
        "versao": "2.0.0",
        "background_ativo": _background_ativo,
        "ultima_localizacao": _ultima_localizacao is not None,
        "alerta_ativo": _carregar_alerta_json().get("alerta_ativo", False),
    }
