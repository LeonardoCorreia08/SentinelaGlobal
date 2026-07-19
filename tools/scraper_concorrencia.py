"""
tools/scraper_concorrencia.py

Módulo de scraping de concorrência para monitoramento de preços de
faculdades rivais. Simula a coleta periódica de dados, detecta
variações de preço e gera alertas automaticamente.

Funcionalidades:
  - Coleta simulada de preços de concorrentes
  - Detecção de variação percentual entre coletas
  - Geração de alertas quando a variação excede o limiar
  - Histórico de preços para análise temporal
"""

import math
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

# ── Base de concorrentes simulada ──────────────────────────────────────────
# Cada concorrente tem um preço base e um desvio padrão para simular
# flutuações realistas de mercado.

CONCORRENTES: Dict[str, Dict[str, Any]] = {
    "usp": {
        "nome": "Universidade de São Paulo (USP)",
        "preco_base": 0.0,
        "desvio": 0.0,
        "cidade": "São Paulo, SP",
        "tipo": "pública",
    },
    "unicamp": {
        "nome": "Universidade Estadual de Campinas (UNICAMP)",
        "preco_base": 0.0,
        "desvio": 0.0,
        "cidade": "Campinas, SP",
        "tipo": "pública",
    },
    "fgv": {
        "nome": "Fundação Getulio Vargas (FGV)",
        "preco_base": 5500.0,
        "desvio": 350.0,
        "cidade": "São Paulo, SP",
        "tipo": "particular",
    },
    "puc-sp": {
        "nome": "Pontifícia Universidade Católica de São Paulo (PUC-SP)",
        "preco_base": 4200.0,
        "desvio": 280.0,
        "cidade": "São Paulo, SP",
        "tipo": "particular",
    },
    "puc-rj": {
        "nome": "Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)",
        "preco_base": 4800.0,
        "desvio": 320.0,
        "cidade": "Rio de Janeiro, RJ",
        "tipo": "particular",
    },
    "insper": {
        "nome": "Insper Instituto de Ensino e Pesquisa",
        "preco_base": 5200.0,
        "desvio": 400.0,
        "cidade": "São Paulo, SP",
        "tipo": "particular",
    },
    "mackenzie": {
        "nome": "Universidade Presbiteriana Mackenzie",
        "preco_base": 3800.0,
        "desvio": 250.0,
        "cidade": "São Paulo, SP",
        "tipo": "particular",
    },
    "ufrj": {
        "nome": "Universidade Federal do Rio de Janeiro (UFRJ)",
        "preco_base": 0.0,
        "desvio": 0.0,
        "cidade": "Rio de Janeiro, RJ",
        "tipo": "pública",
    },
}

# Limiar para gerar alerta (percentual de variação)
ALERTA_LIMIAR_PERCENTUAL: float = 5.0


def coletar_precos() -> Dict[str, Dict[str, Any]]:
    """
    Simula a coleta de preços dos concorrentes em tempo real.

    Para cada concorrente, gera um preço a partir do preço base com
    uma variação aleatória modelada por uma distribuição normal
    (usando o desvio padrão configurado).

    Returns:
        Dict[str, Dict[str, Any]]: Dicionário onde a chave é o slug
        do concorrente e o valor contém nome, preço, cidade, tipo e
        timestamp da coleta.
    """
    agora = datetime.now().isoformat()
    resultados: Dict[str, Dict[str, Any]] = {}

    for slug, dados in CONCORRENTES.items():
        if dados["preco_base"] == 0:
            preco = 0.0
        else:
            # Gera variação realista usando Box-Muller approx
            u1 = random.random()
            u2 = random.random()
            z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
            variacao = z * dados["desvio"]
            preco = round(max(dados["preco_base"] + variacao, dados["preco_base"] * 0.85), 2)

        resultados[slug] = {
            "slug": slug,
            "nome": dados["nome"],
            "preco": preco,
            "cidade": dados["cidade"],
            "tipo": dados["tipo"],
            "timestamp": agora,
        }

    return resultados


def detectar_alertas(
    coleta_atual: Dict[str, Dict[str, Any]],
    coleta_anterior: Optional[Dict[str, Dict[str, Any]]],
    limiar_percentual: float = ALERTA_LIMIAR_PERCENTUAL,
) -> List[Dict[str, Any]]:
    """
    Compara a coleta atual com a anterior e gera alertas para
    variações que excedem o limiar percentual configurado.

    Args:
        coleta_atual: Resultado da coleta mais recente.
        coleta_anterior: Resultado da coleta anterior (pode ser None).
        limiar_percentual: Percentual mínimo de variação para alertar
            (padrão: 5.0%%).

    Returns:
        List[Dict[str, Any]]: Lista de alertas gerados, cada um com
        slug, nome, preco_antigo, preco_novo, variacao_percentual,
        direcao (subiu/desceu) e timestamp.
    """
    alertas: List[Dict[str, Any]] = []
    agora = datetime.now().isoformat()

    if not coleta_anterior:
        return alertas

    for slug, dados_atuais in coleta_atual.items():
        dados_anteriores = coleta_anterior.get(slug)
        if not dados_anteriores:
            continue

        preco_antigo = dados_anteriores["preco"]
        preco_novo = dados_atuais["preco"]

        # Pula se algum dos preços for zero (pública)
        if preco_antigo == 0 or preco_novo == 0:
            continue

        # Calcula variação percentual
        if preco_antigo > 0:
            variacao = ((preco_novo - preco_antigo) / preco_antigo) * 100.0
        else:
            variacao = 0.0

        if abs(variacao) >= limiar_percentual:
            alertas.append({
                "slug": slug,
                "nome": dados_atuais["nome"],
                "preco_antigo": preco_antigo,
                "preco_novo": preco_novo,
                "variacao_percentual": round(variacao, 2),
                "direcao": "subiu" if variacao > 0 else "desceu",
                "timestamp": agora,
            })

    return alertas


def gerar_historico_simulado(dias: int = 30) -> List[Dict[str, Any]]:
    """
    Gera um histórico simulado de preços para os últimos N dias.

    Útil para preencher o gráfico de tendência na interface quando
    não há dados reais acumulados.

    Args:
        dias: Número de dias de histórico (padrão: 30).

    Returns:
        List[Dict[str, Any]]: Lista de pontos de preço, cada um com
        slug, nome, preco e data.
    """
    historico: List[Dict[str, Any]] = []
    hoje = datetime.now()

    for slug, dados in CONCORRENTES.items():
        if dados["preco_base"] == 0:
            continue  # Pula públicas (preço zero)

        for dia in range(dias, -1, -1):
            data = hoje - timedelta(days=dia)
            # Gera preço com tendência suave + ruído
            tendencia = math.sin(dia / 7.0 * math.pi) * dados["desvio"] * 0.5
            ruido = random.gauss(0, dados["desvio"] * 0.3)
            preco = round(dados["preco_base"] + tendencia + ruido, 2)

            historico.append({
                "slug": slug,
                "nome": dados["nome"],
                "preco": max(preco, dados["preco_base"] * 0.8),
                "data": data.strftime("%Y-%m-%d"),
            })

    return historico


def listar_concorrentes() -> List[Dict[str, Any]]:
    """
    Retorna a lista de todos os concorrentes monitorados.

    Returns:
        List[Dict[str, Any]]: Lista com slug, nome, cidade, tipo e
        preco_base de cada concorrente.
    """
    return [
        {
            "slug": slug,
            "nome": dados["nome"],
            "preco_base": dados["preco_base"],
            "cidade": dados["cidade"],
            "tipo": dados["tipo"],
        }
        for slug, dados in CONCORRENTES.items()
    ]
