"""
tools/monitor.py

Módulo de monitoramento de riscos do SentinelaGlobal.
Simula a consulta a agências de desastres (USGS/NOAA/Notícias)
e calcula o impacto de eventos próximos à localização do usuário.

Funções principais:
  - verificar_riscos(user_location) → lista de eventos próximos
  - calcular_impacto(evento, user_location) → percentual de risco (0-100)
"""

import math
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

# ── Base de eventos simulados por região do Brasil ─────────────────────
# Cada evento representa um desastre natural com severidade de 1 a 5.

EVENTOS_BASE: List[Dict[str, Any]] = [
    # ═══ Região Sudeste ═══
    {
        "id": "e001",
        "tipo": "enchente",
        "severidade": 4,
        "lat": -23.5505,
        "lon": -46.6333,
        "regiao": "São Paulo, SP",
        "descricao": "Enchente histórica na Marginal Tietê — transbordamento do Rio Tietê afeta vias expressas e bairros da Zona Norte.",
        "fonte": "USGS / Cemaden",
    },
    {
        "id": "e002",
        "tipo": "deslizamento",
        "severidade": 3,
        "lat": -23.5628,
        "lon": -46.6547,
        "regiao": "São Paulo, SP",
        "descricao": "Deslizamento de encosta em área de risco na Zona Sul após chuvas intensas de 120mm em 24h.",
        "fonte": "Defesa Civil SP",
    },
    {
        "id": "e003",
        "tipo": "tempestade",
        "severidade": 3,
        "lat": -22.9068,
        "lon": -43.1729,
        "regiao": "Rio de Janeiro, RJ",
        "descricao": "Tempestade severa com ventos de até 90 km/h e granizo em partes da Zona Sul e Grande Tijuca.",
        "fonte": "INMET / NOAA",
    },
    {
        "id": "e004",
        "tipo": "deslizamento",
        "severidade": 5,
        "lat": -22.9314,
        "lon": -43.2813,
        "regiao": "Rio de Janeiro, RJ",
        "descricao": "Deslizamento crítico na Rocinha — solo saturado após 5 dias consecutivos de chuva. Risco iminente de novas quedas.",
        "fonte": "USGS / Geo-Rio",
    },
    {
        "id": "e005",
        "tipo": "enchente",
        "severidade": 2,
        "lat": -19.9167,
        "lon": -43.9345,
        "regiao": "Belo Horizonte, MG",
        "descricao": "Alagamento em vias expressas do centro. Córregos transbordaram com 60mm de chuva em 2h.",
        "fonte": "Defesa Civil MG",
    },
    # ═══ Região Sul ═══
    {
        "id": "e006",
        "tipo": "ciclone",
        "severidade": 4,
        "lat": -29.9547,
        "lon": -51.0808,
        "regiao": "Porto Alegre, RS",
        "descricao": "Ciclone extratropical categoría 2 com risco severo de inundação costeira e ressaca no Lago Guaíba.",
        "fonte": "NOAA / Metsul",
    },
    {
        "id": "e007",
        "tipo": "enchente",
        "severidade": 5,
        "lat": -29.7845,
        "lon": -51.1472,
        "regiao": "Porto Alegre, RS",
        "descricao": "Enchente severa no Lago Guaíba — nível ultrapassou 3,5m. Bairros inteiros submersos na Zona Sul.",
        "fonte": "USGS / Defesa Civil RS",
    },
    # ═══ Região Nordeste ═══
    {
        "id": "e008",
        "tipo": "seca",
        "severidade": 3,
        "lat": -8.0578,
        "lon": -34.8829,
        "regiao": "Recife, PE",
        "descricao": "Estiagem prolongada (120 dias sem chuva) afetando abastecimento de água em bairros periféricos.",
        "fonte": "ANA / INMET",
    },
    {
        "id": "e009",
        "tipo": "tempestade",
        "severidade": 4,
        "lat": -12.9714,
        "lon": -38.5014,
        "regiao": "Salvador, BA",
        "descricao": "Tempestade tropical com volume de 150mm em 24h — alagamentos generalizados e deslizamentos pontuais.",
        "fonte": "NOAA / INMET",
    },
    # ═══ Região Norte ═══
    {
        "id": "e010",
        "tipo": "enchente",
        "severidade": 3,
        "lat": -3.1190,
        "lon": -60.0217,
        "regiao": "Manaus, AM",
        "descricao": "Enchente do Rio Negro — nível 2m acima da cota de alerta, comunidades ribeirinhas afetadas.",
        "fonte": "USGS / CPRM",
    },
    # ═══ Região Centro-Oeste ═══
    {
        "id": "e011",
        "tipo": "queimada",
        "severidade": 4,
        "lat": -15.7939,
        "lon": -47.8828,
        "regiao": "Brasília, DF",
        "descricao": "Queimadas no Parque Nacional de Brasília — fumaça encobre o Plano Piloto, visibilidade reduzida.",
        "fonte": "INPE / Prevfogo",
    },
    {
        "id": "e012",
        "tipo": "tempestade",
        "severidade": 2,
        "lat": -15.5989,
        "lon": -56.0979,
        "regiao": "Cuiabá, MT",
        "descricao": "Tempestade isolada com rajadas de 60km/h e queda de energia em bairros da região central.",
        "fonte": "INMET",
    },
]


def _haversine_km(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calcula a distância em quilômetros usando a fórmula de Haversine.
    """
    raio_terra = 6371.0
    lat1_r = math.radians(lat1)
    lon1_r = math.radians(lon1)
    lat2_r = math.radians(lat2)
    lon2_r = math.radians(lon2)
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(raio_terra * c, 2)


def verificar_riscos(
    user_location: Dict[str, float],
    raio_busca_km: float = 300.0,
) -> List[Dict[str, Any]]:
    """
    Simula a consulta a agências de desastres (USGS, NOAA, Defesa Civil,
    INMET) e retorna eventos de risco próximos à localização do usuário.

    Para cada evento da base, calcula a distância até o usuário e filtra
    aqueles dentro do raio de busca.

    Args:
        user_location: Dicionário com chaves ``lat`` e ``lon``.
        raio_busca_km: Raio máximo de busca em km (padrão: 300 km).

    Returns:
        Lista de eventos dentro do raio, ordenados por distância
        crescente. Cada evento contém id, tipo, severidade, coordenadas,
        distância_km, descricao e fonte.
    """
    lat_u = user_location.get("lat", 0.0)
    lon_u = user_location.get("lon", 0.0)

    eventos_proximos: List[Dict[str, Any]] = []

    for evento in EVENTOS_BASE:
        distancia = _haversine_km(lat_u, lon_u, evento["lat"], evento["lon"])

        if distancia <= raio_busca_km:
            evento_com_distancia = dict(evento)
            evento_com_distancia["distancia_km"] = distancia
            evento_com_distancia["user_location"] = {
                "lat": lat_u,
                "lon": lon_u,
            }
            eventos_proximos.append(evento_com_distancia)

    # Ordena por distância (mais próximo primeiro)
    eventos_proximos.sort(key=lambda e: e["distancia_km"])

    return eventos_proximos


def calcular_impacto(
    evento: Dict[str, Any],
    user_location: Dict[str, float],
) -> float:
    """
    Calcula o percentual de risco (0 a 100) baseado na distância entre
    o usuário e o evento e na severidade do desastre.

    Fórmula:
        risco_base = severidade * 20  (severidade 1 → 20%, 5 → 100%)
        fator_distancia:
          - distancia <=   5 km → 1.0  (crítico)
          - distancia <=  50 km → 0.7  (alto)
          - distancia <= 100 km → 0.5  (médio)
          - distancia <= 200 km → 0.25 (baixo)
          - distancia >  200 km → 0.1  (mínimo)
        risco_final = min(risco_base * fator_distancia * 1.2, 100)

    Args:
        evento: Dicionário do evento contendo ``severidade`` (1-5) e
                ``distancia_km`` (calculada por ``verificar_riscos``).
        user_location: Dicionário com ``lat`` e ``lon`` do usuário.

    Returns:
        Percentual de risco arredondado para inteiro (0 a 100).
    """
    severidade = evento.get("severidade", 1)
    distancia_km = evento.get("distancia_km", 999.0)

    # Risco base: severidade 1 → 20%, severidade 5 → 100%
    risco_base = severidade * 20.0

    # Fator de distância
    if distancia_km <= 5:
        fator_distancia = 1.0
    elif distancia_km <= 50:
        fator_distancia = 0.7
    elif distancia_km <= 100:
        fator_distancia = 0.5
    elif distancia_km <= 200:
        fator_distancia = 0.25
    else:
        fator_distancia = 0.1

    # Risco final com fator de segurança 1.2
    risco_final = min(risco_base * fator_distancia * 1.2, 100.0)

    return round(risco_final, 1)


def calcular_risco_geral(
    user_location: Dict[str, float],
) -> Dict[str, Any]:
    """
    Função principal que integra ``verificar_riscos`` e ``calcular_impacto``.

    Para cada evento próximo, calcula o impacto individual e armazena.
    Retorna também o risco geral (máximo entre todos os eventos).

    Args:
        user_location: Dicionário com ``lat`` e ``lon``.

    Returns:
        Dicionário com:
          - eventos: lista de eventos com impacto calculado
          - risco_geral: percentual máximo de risco
          - evento_critico: evento de maior risco (ou None se vazio)
    """
    eventos = verificar_riscos(user_location)

    if not eventos:
        return {
            "eventos": [],
            "risco_geral": 0.0,
            "evento_critico": None,
        }

    for evento in eventos:
        evento["impacto_percentual"] = calcular_impacto(evento, user_location)

    # Ordena por impacto decrescente
    eventos.sort(key=lambda e: e["impacto_percentual"], reverse=True)

    evento_critico = eventos[0] if eventos else None

    return {
        "eventos": eventos,
        "risco_geral": evento_critico["impacto_percentual"] if evento_critico else 0.0,
        "evento_critico": evento_critico,
    }
