"""
tools/scraper.py

Módulo para simular extração de dados de faculdades e cálculo de distâncias.
Fornece funções com type hints e docstrings claras, projetadas para
serem usadas como ferramentas (tools) em sistemas de LLM com Tool Calling.
"""

import math
from typing import Dict, Optional


def buscar_dados_faculdade(nome_faculdade: str) -> Dict[str, Optional[str | float]]:
    """
    Simula a extração de dados públicos de uma faculdade a partir de seu nome.

    Esta função consulta uma base simulada de faculdades brasileiras e retorna
    informações como nome oficial, mensalidade estimada, curso de destaque e
    localização geográfica (latitude/longitude).

    Args:
        nome_faculdade (str): Nome ou parte do nome da faculdade a ser pesquisada.
            Exemplos: "USP", "FGV", "UNICAMP", "PUC-SP".

    Returns:
        Dict[str, Optional[str | float]]: Um dicionário contendo:
            - nome (str): Nome completo da faculdade.
            - mensalidade_estimada (float): Valor estimado da mensalidade em R$.
            - curso (str): Curso de destaque da instituição.
            - localidade (str): Cidade e estado onde a faculdade está sediada.
            - latitude (float): Latitude aproximada da sede.
            - longitude (float): Longitude aproximada da sede.

    Example:
        >>> resultado = buscar_dados_faculdade("USP")
        >>> resultado["nome"]
        'Universidade de São Paulo (USP)'
        >>> resultado["mensalidade_estimada"]
        0.0
    """
    base_dados: Dict[str, Dict[str, Optional[str | float]]] = {
        "usp": {
            "nome": "Universidade de São Paulo (USP)",
            "mensalidade_estimada": 0.0,
            "curso": "Engenharia de Computação",
            "localidade": "São Paulo, SP",
            "latitude": -23.5610,
            "longitude": -46.7309,
        },
        "unicamp": {
            "nome": "Universidade Estadual de Campinas (UNICAMP)",
            "mensalidade_estimada": 0.0,
            "curso": "Medicina",
            "localidade": "Campinas, SP",
            "latitude": -22.8269,
            "longitude": -47.0718,
        },
        "fgv": {
            "nome": "Fundação Getulio Vargas (FGV)",
            "mensalidade_estimada": 5500.0,
            "curso": "Administração de Empresas",
            "localidade": "São Paulo, SP",
            "latitude": -23.5679,
            "longitude": -46.6475,
        },
        "puc-sp": {
            "nome": "Pontifícia Universidade Católica de São Paulo (PUC-SP)",
            "mensalidade_estimada": 4200.0,
            "curso": "Direito",
            "localidade": "São Paulo, SP",
            "latitude": -23.5587,
            "longitude": -46.6605,
        },
        "puc-rj": {
            "nome": "Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)",
            "mensalidade_estimada": 4800.0,
            "curso": "Ciência da Computação",
            "localidade": "Rio de Janeiro, RJ",
            "latitude": -22.9798,
            "longitude": -43.2345,
        },
        "ufrj": {
            "nome": "Universidade Federal do Rio de Janeiro (UFRJ)",
            "mensalidade_estimada": 0.0,
            "curso": "Engenharia Civil",
            "localidade": "Rio de Janeiro, RJ",
            "latitude": -22.8625,
            "longitude": -43.2234,
        },
        "insper": {
            "nome": "Insper Instituto de Ensino e Pesquisa",
            "mensalidade_estimada": 5200.0,
            "curso": "Engenharia Mecatrônica",
            "localidade": "São Paulo, SP",
            "latitude": -23.5882,
            "longitude": -46.6836,
        },
        "mackenzie": {
            "nome": "Universidade Presbiteriana Mackenzie",
            "mensalidade_estimada": 3800.0,
            "curso": "Arquitetura e Urbanismo",
            "localidade": "São Paulo, SP",
            "latitude": -23.5465,
            "longitude": -46.6505,
        },
    }

    chave = nome_faculdade.strip().lower()

    # Busca exata primeiro
    if chave in base_dados:
        return dict(base_dados[chave])

    # Busca parcial — retorna a primeira correspondência parcial
    for chave_base, dados in base_dados.items():
        if chave in chave_base or chave_base in chave:
            return dict(dados)

    # Nenhuma correspondência encontrada
    return {
        "nome": None,
        "mensalidade_estimada": None,
        "curso": None,
        "localidade": None,
        "latitude": None,
        "longitude": None,
    }


def calcular_distancia(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calcula a distância em quilômetros entre dois pontos geográficos
    usando a fórmula de Haversine.

    A fórmula de Haversine é adequada para calcular distâncias de grande
    círculo (ortoédricas) entre dois pontos na superfície de uma esfera —
    neste caso, a Terra —, levando em consideração a curvatura do planeta.

    Args:
        lat1 (float): Latitude do primeiro ponto (em graus decimais).
        lon1 (float): Longitude do primeiro ponto (em graus decimais).
        lat2 (float): Latitude do segundo ponto (em graus decimais).
        lon2 (float): Longitude do segundo ponto (em graus decimais).

    Returns:
        float: Distância entre os dois pontos em quilômetros, com
               precisão de duas casas decimais.

    Example:
        >>> calcular_distancia(-23.5610, -46.7309, -22.8269, -47.0718)
        83.42
    """
    raio_terra_km: float = 6371.0

    # Converte graus decimais para radianos
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Diferenças entre as coordenadas
    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad

    # Fórmula de Haversine
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distancia_km = raio_terra_km * c
    return round(distancia_km, 2)
