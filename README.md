# 🛰️ SentinelaGlobal

**Sistema inteligente de monitoramento de riscos e desastres naturais em tempo real.**

O SentinelaGlobal analisa dados de agências internacionais de desastres (USGS, GDACS, NASA, NOAA, Copernicus, INMET) com IA generativa, calcula o nível de ameaça próximo à sua localização e emite alertas visuais e sonoros quando o risco ultrapassa 80%.

---

## 🧠 Engenharia de IA e Decisões Técnicas

Esta seção detalha o processo de engenharia por trás da integração da IA.

### 1. Arquitetura de LLM

O sistema utiliza uma Pipeline de Inferência Baseada em Eventos:

```
Input (Dados Geoespaciais + Clima)
  → [Cálculo Determinístico (Fator Risco)]
    → [System Prompt com Few-Shot]
      → [Groq API (Llama 3.3 70B)]
        → [Validador de Schema Flexível (PT/EN)]
          → [UI/Dashboard]
```

### 2. Decisões de Engenharia

- **Modelo:** Groq (Llama 3.3 70B). Justificativa: Latência ultrabaixa, essencial para alertas de desastres, aliada a reasoning de alto nível para interpretação de múltiplos datasets.
- **Framework:** Chamadas diretas à API. Justificativa: Priorizamos performance e controle total do payload, evitando abstrações pesadas.
- **Temperatura (0.1):** Minimiza alucinações e garante determinismo técnico em situações de emergência.

### 3. Estratégia de Prompting

Utilizamos Few-Shot Prompting com schema JSON explícito no system prompt, forçando o modelo a retornar campos específicos com valores exatos. O validador aceita tanto nomes em **PT** quanto **EN** (ex: `resumo_executivo` ou `executive_summary`, `recomendacoes` ou `recommendations`).

### 4. Robustez e Resiliência (Circuit Breaker)

- **Validação de Schema Flexível:** Validador manual que busca campos por múltiplos nomes (PT + EN) — `analise_detalhada` é opcional, `tendencia` aceita variações como "aumentando"/"up"/"rising"
- **Cadeia de 3 tentativas:** `freebuff.com.completion()` → `API Groq direta` → `Análise Local` (fallback determinístico)
- **Trava de processamento:** `processandoRef` impede execuções concorrentes do polling
- **Cooldown inteligente:** Se nenhum evento dentro de 30km, pausa requisições por 15min
- **Transparência:** Badges no Dashboard informam a origem (🤖 IA Real / 📊 Fallback Local)

### 5. System Prompt e Configuração da LLM

#### 5.1 System Prompt (freebuff.com.completion)

```
Você é o SentinelaGlobal, um analista de riscos de desastres naturais especializado em análise geoespacial multi-fonte.

Analise os dados de monitoramento abaixo e retorne APENAS um JSON válido seguindo EXATAMENTE este schema:

{
  "resumo_executivo": "Uma frase curta com o nível de risco e recomendação principal. (STRING, uma linha)",
  "analise_detalhada": "Contexto técnico mencionando as fontes e eventos. (STRING, pode ser vazia)",
  "recomendacoes": ["Ação 1", "Ação 2"],
  "tendencia": "aumentando" | "estabilizando" | "diminuindo",
  "nivel_confianca": "alta" | "media" | "baixa"
}

IMPORTANTE:
- resumo_executivo deve ser uma STRING de texto curto, NÃO um objeto.
- recomendacoes deve ser um ARRAY de strings.
- tendencia deve ser EXATAMENTE "aumentando", "estabilizando" ou "diminuindo".
- nivel_confianca deve ser EXATAMENTE "alta", "media" ou "baixa".

Exemplo de resposta CORRETA:
{
  "resumo_executivo": "Risco moderado (45%) com tempestade a 80 km. Monitore a situação.",
  "analise_detalhada": "Tempestade severa detectada pelo INMET a 80 km de distância. Ventos de 90 km/h.",
  "recomendacoes": ["Fique atento a boletins meteorológicos", "Evite áreas alagáveis"],
  "tendencia": "aumentando",
  "nivel_confianca": "media"
}

Cite fontes (USGS, GDACS, Cemaden, Open-Meteo, INMET, NASA FIRMS, EMSC, NOAA, Copernicus).
Responda em português brasileiro.
```

#### 5.2 System Prompt (API Groq Direta — Fallback)

```
Você é o SentinelaGlobal, analista de riscos de desastres naturais.
Retorne APENAS um JSON com campos:
  resumo_executivo (string curta),
  analise_detalhada (string),
  recomendacoes (array strings),
  tendencia (aumentando/estabilizando/diminuindo),
  nivel_confianca (alta/media/baixa).

IMPORTANTE: resumo_executivo DEVE ser string, NUNCA objeto.
Cite fontes (USGS, GDACS, INMET, NOAA, Copernicus, NASA FIRMS).
Responda em português brasileiro. Sem prefácio nem comentários.
```

#### 5.3 Template do User Prompt

```
Nível de risco geral: {risco_geral}% ({nivel_alerta})
Fontes ativas: {fontes_ativas}

Eventos detectados:
- {tipo} (severidade {severidade}/5, {distancia_km}km, impacto {impacto}%, fonte: {fonte})
[...]

Condições meteorológicas locais:
Temperatura: {temperatura}°C
Precipitação atual: {precipitacao}mm
Vento: {vento} km/h
Probabilidade de chuva: {probabilidade_chuva}%
```

> Os dados de eventos e clima são inseridos **diretamente no prompt** (inline prompt context), não via tool calling. A LLM recebe tudo na mensagem do usuário e retorna um JSON estruturado.

#### 5.4 Parâmetros da API

| Parâmetro | freebuff.com.completion | API Groq Direta |
|-----------|------------------------|-----------------|
| **Modelo** | `groq-llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` |
| **Temperature** | `0.1` | `0.1` |
| **Max Tokens** | `1000` | `1500` |
| **response_format** | Padrão (texto) | `{ type: "json_object" }` |
| **Endpoint** | (via VLY Integrations) | `https://api.groq.com/openai/v1/chat/completions` |

> **Temperature 0.1** é propositalmente baixa para minimizar alucinações e garantir determinismo em situações de emergência.

#### 5.5 Schema de Resposta (JSON)

```json
{
  "resumo_executivo": "string — resumo de uma linha",
  "analise_detalhada": "string — contexto técnico multi-fonte",
  "recomendacoes": ["string", "string", ...],
  "tendencia": "aumentando" | "estabilizando" | "diminuindo",
  "nivel_confianca": "alta" | "media" | "baixa",
  "modelo_utilizado": "Groq Llama 3 (freebuff.com)",
  "fontes_analisadas": ["USGS", "INMET", ...]
}
```

#### 5.6 Validação Flexível (PT/EN)

O validador (`validarAnaliseLLM`) aceita os campos em **português** ou **inglês**:

| Campo PT | Campo EN | Obrigatório |
|----------|----------|-------------|
| `resumo_executivo` | `executive_summary`, `resumo`, `summary` | ✅ Sim |
| `analise_detalhada` | `detailed_analysis`, `analysis`, `analise` | ❌ Opcional |
| `recomendacoes` | `recommendacoes`, `recommendations`, `recommends`, `acoes`, `actions` | ✅ Sim (aceita vazio) |
| `tendencia` | `trend`, `tendency` | ✅ Sim (default: estabilizando) |
| `nivel_confianca` | `confidence`, `confianca`, `confidence_level` | ✅ Sim (default: media) |

> `tendencia` aceita variações semânticas: "aumentando" / "up" / "rising" / "aument" → `"aumentando"`. "diminuindo" / "down" / "falling" / "diminu" → `"diminuindo"`.

#### 5.7 Sobre Tool Calling

O SentinelaGlobal **não utiliza tool calling**. Em vez de a LLM chamar funções para buscar dados, os dados geoespaciais e meteorológicos são **pré-processados e inseridos diretamente no user prompt** como contexto. A LLM atua exclusivamente como **analista** — interpreta os dados que já recebeu e retorna uma análise estruturada em JSON.

**Motivos da decisão:**
- Menos latência (não há round-trips de tool calling)
- Controle total sobre quais dados são enviados (já filtrados e calculados pelo `calcularRiscoLocal`)
- Schema de resposta 100% controlado pelo validador (evita alucinações de tool call)
- Fallback determinístico (`analisarLocal`) que não depende de LLM nenhuma

#### 5.8 Cadeia de Tentativas (Circuit Breaker)

```
Tentativa 1: freebuff.com.completion()  ──→ Sucesso? ✅ Retorna
       ↓ falha
Tentativa 2: API Groq Direta             ──→ Sucesso? ✅ Retorna
       ↓ falha
Tentativa 3: Análise Local (fallback)    ──→ Sempre retorna (garantido)
```

### 6. Proxy Server-Side (CORS)

Todas as APIs externas de monitoramento são consultadas **via Convex Action** (server-side), eliminando completamente os erros de CORS. O navegador só faz fetch direto como fallback para APIs que permitem CORS (USGS, Open-Meteo, NWS, OpenFEMA).

---

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Arquitetura de Dados](#-arquitetura-de-dados)
- [Fontes de Dados](#-fontes-de-dados)
- [Páginas do Sistema](#-páginas-do-sistema)
- [Como Usar](#-como-usar)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Contribuição](#-contribuição)
- [Licença](#-licença)

---

## 🚀 Funcionalidades

### 🔍 Monitoramento Contínuo
- Análise automática com dados **REAIS** de múltiplas agências internacionais
- Polling dinâmico: **2 minutos** em risco crítico (>80%), **10 minutos** em risco seguro
- Raio de busca ajustável de **5 km a 40.000 km**
- Cálculo de risco baseado em severidade do evento × fator de distância
- **Trava de processamento** — impede execuções concorrentes do polling
- **Cooldown de 15min** — se nenhum evento dentro de 30km, pausa requisições automaticamente
- **Botão "Forçar verificação"** — antecipa o cooldown e dispara nova análise

### 🗺️ Mapa Interativo (Leaflet)
- Mapa de localização com marcador do usuário
- Círculo de raio de busca ao redor da posição do usuário
- **Mapa Mundial** com todos os eventos globais filtrados por tipo de catástrofe
- Marcadores coloridos por tipo e severidade do evento

### 📊 Gráficos SVG (zero dependências externas)
- **Gráfico de Tendência de Risco** — histórico horário com previsão para próximas 6h
- **Previsão de Chuva** — precipitação prevista para as próximas 6 horas com probabilidade
- **Histórico de Chuva 24h** — barras de precipitação das últimas 24 horas
- Linha de alerta 80% com destaque visual

### 🌍 Notícias Globais por Catástrofe
- Agrupamento por **16 tipos de catástrofe**
- Cada categoria com expandir/recolher: **5 itens recolhido / 15 expandido**
- Links diretos para fonte original (USGS, GDACS, NASA FIRMS)

### 🤖 AI Insights (Análise com IA)
- Resumo executivo do cenário de risco
- Análise detalhada com contexto técnico multi-fonte
- Recomendações específicas baseadas no nível de risco
- Tendência: aumentando 📈 / estabilizando 📊 / diminuindo 📉
- Nível de confiança da análise (alta / média / baixa)
- **Cadeia de 3 tentativas**: freebuff.com → Groq API → Fallback local

### 🌧️ Alerta de Chuva (Classificação INMET)
- Classificação oficial INMET: Fraca (0.1–5.0), Moderada (5.1–25.0), Forte (25.1–50.0), Severa (50.1–100.0), Extrema (>100.0) mm/h
- Classificação por código WMO (World Meteorological Organization)
- Fontes: INMET, Open-Meteo, OpenWeatherMap, WeatherAPI

### 🔔 Notificações Push
- Notificações críticas quando risco > 80%
- **Som de alerta** via Web Audio API (oscilador duplo)
- **Vibração** em dispositivos móveis
- Ação "Ver mapa" na notificação
- Badge com contador de novos alertas

### 🎯 Eventos Próximos
- Lista detalhada com severidade, distância e impacto percentual
- Análise gerada por IA para cada evento
- Badges: fonte do dado, distância, impacto
- Cores por nível: verde (baixo), âmbar (moderado), laranja (alto), rosa (crítico)

### 📍 Geolocalização
- Solicitação de localização ao carregar
- Botão "Atualizar localização"
- Precisão alta com timeout de 10s

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia |
|-----------|-----------|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Roteamento** | React Router 7 |
| **Estilos** | Tailwind CSS 4, shadcn/ui, Framer Motion |
| **Mapas** | Leaflet + react-leaflet |
| **Backend/Database** | Convex (realtime queries, actions, mutations) |
| **Autenticação** | Convex Auth (Google OAuth, anônimo) |
| **IA/LLM** | freebuff.com.completion (Groq + Llama 3), API Groq direta, fallback local |
| **Ícones** | Lucide React |
| **Gráficos** | SVG puro (zero dependências externas) |
| **Pacotes** | Bun |

---

## 🏗️ Arquitetura de Dados

### Fluxo de Requisições (Proxy Server-Side)

```
Navegador (React)
    │
    ├── 1. Convex Action (proxyApi.ts) ← server-side, SEM CORS
    │       │
    │       ├── USGS (terremotos)
    │       ├── GDACS (desastres globais)
    │       ├── EMSC (terremotos Europa)
    │       ├── USGS Volcano (vulcões)
    │       ├── OpenFEMA (desastres EUA)
    │       ├── Copernicus EMS (queimadas/enchentes Europa)
    │       ├── NOAA NHC (furacões Atlântico)
    │       ├── NASA FIRMS (queimadas mundo)
    │       ├── Open-Meteo (clima)
    │       ├── OpenWeatherMap (clima)
    │       ├── WeatherAPI (clima)
    │       ├── NWS Tsunami (alertas)
    │       └── INMET (precipitação Brasil)
    │
    └── 2. Fetch direto (fallback) — APENAS APIs CORS-friendly
            ├── USGS ✅
            ├── OpenFEMA ✅
            ├── NWS Tsunami ✅
            ├── NASA FIRMS ✅ (com chave)
            ├── Open-Meteo ✅
            ├── OpenWeatherMap ✅ (com chave)
            └── WeatherAPI ✅ (com chave)
```

### Por que proxy Convex?

Todas as APIs de monitoramento (GDACS, NOAA NHC, Copernicus EMS, EMSC, USGS Volcano) **bloqueiam CORS** quando chamadas diretamente do navegador. Em vez de criar um backend separado, usamos uma **Convex Action** (`"use node"`) que faz as chamadas server-side — sem erros CORS, sem infraestrutura extra.

### Limites Convex

- **Array max 8192 itens** — todos os arrays retornados pela proxy action são limitados com `.slice(0, 500)`
- APIs individuais já limitam na origem (ex: FIRMS 30 linhas, USGS 20 features)

### Economia de Requisições (Cooldown)

- Se após uma análise **nenhum evento estiver dentro de 30km** do usuário, o sistema entra em **cooldown de 15 minutos**
- Durante o cooldown, **nenhuma requisição é feita** (nem polling)
- O usuário pode clicar em **"Forçar verificação"** para antecipar
- Se houver eventos próximos, o polling normal continua (2min crítico / 10min seguro)

---

## 🌐 Fontes de Dados

O sistema consulta **13 fontes** de dados:

| Fonte | Dados | Chave | CORS (browser) |
|-------|-------|-------|----------------|
| [USGS](https://earthquake.usgs.gov) | Terremotos (magnitude ≥ 4.5, últimas 24h) | ❌ Gratuita | ✅ |
| [GDACS](https://www.gdacs.org) | Desastres globais | ❌ Gratuita | ❌ (proxy) |
| [EMSC](https://www.seismicportal.eu) | Terremotos (fallback europeu) | ❌ Gratuita | ❌ (proxy) |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | Queimadas ativas (VIIRS) | ✅ Requer chave | ✅ (com chave) |
| [USGS Volcano](https://volcanoes.usgs.gov) | Alertas vulcânicos | ❌ Gratuita | ❌ (proxy) |
| [NOAA NHC](https://www.nhc.noaa.gov) | Furacões (Atlântico) | ❌ Gratuita | ❌ (proxy) |
| [Open-Meteo](https://open-meteo.com) | Meteorologia (temp., chuva, vento, previsão 6h, histórico 24h) | ❌ Gratuita | ✅ |
| [NOAA NWS](https://www.weather.gov) | Alertas de tsunami | ❌ Gratuita | ✅ |
| [OpenFEMA](https://www.fema.gov) | Desastres nos EUA | ❌ Gratuita | ✅ |
| [Copernicus EMS](https://emergency.copernicus.eu) | Queimadas, enchentes (Europa/mundo) | ❌ Gratuita | ❌ (proxy) |
| [INMET](https://apitempo.inmet.gov.br) | Estações meteorológicas (Brasil) | ❌ Gratuita | ✅ |
| [OpenWeatherMap](https://openweathermap.org) | Meteorologia (fallback) | ✅ Requer chave | ✅ |
| [WeatherAPI](https://www.weatherapi.com) | Meteorologia (fallback) | ✅ Requer chave | ✅ |

> ⚠️ **Nota:** Cemaden removido por mixed content (HTTP em página HTTPS). CORS-blocked APIs (GDACS, EMSC, USGS Volcano, Copernicus EMS, NOAA NHC) funcionam **apenas via proxy Convex** — não são chamadas do navegador.

---

## 📄 Páginas do Sistema

### `/` — Landing Page
Página inicial com hero, cards de funcionalidades, seção de fontes e CTAs.

### `/dashboard` — SentinelaDashboard (Principal)
Painel completo de monitoramento com:
- Status do sistema, gráficos SVG, AI Insights, notícias globais, eventos próximos, mapas local e mundial

### `/auth` — Autenticação
Login com Google OAuth e entrada como convidado.

### `/apoiar` — Apoie o Projeto
Página de contribuição via PIX com QR Code.

---

## 📖 Como Usar

### 1. Acessar o Sistema
Abra o SentinelaGlobal no navegador. Clique em **"Iniciar monitoramento"**.

### 2. Permitir Localização
Permita o acesso à localização para cálculo de riscos e mapas.

### 3. Monitorar Riscos
O sistema automaticamente busca dados das APIs via proxy Convex, calcula risco e gera análise com IA.

### 4. Configurar Alertas
- Ajuste o **raio de busca** (5 km a 40.000 km)
- Ative **notificações push**
- Use **"Forçar verificação"** para antecipar o polling

---

## 📁 Estrutura do Projeto

```
src/
├── components/ui/          # Componentes shadcn/ui
├── convex/
│   ├── auth/               # Provedores de autenticação
│   ├── auth.config.ts      # Configuração de auth
│   ├── auth.ts             # Convex Auth
│   ├── http.ts             # HTTP endpoints
│   ├── monitoramento.ts    # Queries e mutations de risco
│   ├── proxyApi.ts         # ⬅️ Convex Action proxy (server-side, sem CORS)
│   ├── schema.ts           # Schema do banco Convex
│   └── users.ts            # Helper de usuário
├── hooks/
│   ├── use-auth.ts         # Hook de autenticação
│   └── use-mobile.ts       # Hook de detecção mobile
├── lib/
│   ├── alerta-chuva.ts     # Classificação INMET
│   ├── api-mundiais.ts     # ⬅️ Integração multi-camada (Convex → browser)
│   ├── llm-service.ts      # ⬅️ LLM com schema flexível PT/EN
│   ├── risco-local.ts      # Cálculo de risco
│   ├── utils.ts            # Utilitários
│   └── vly-integrations.ts # Configuração VLY
├── pages/
│   ├── Landing.tsx         # Página inicial
│   ├── SentinelaDashboard.tsx  # Painel principal
│   ├── Auth.tsx            # Login
│   ├── Apoiar.tsx          # PIX
│   └── NotFound.tsx        # 404
├── index.css               # Estilos globais
├── instrumentation.tsx     # Error boundary
└── main.tsx                # Entry point + rotas
```

---

## ⚙️ Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `VITE_CONVEX_URL` | URL do deployment Convex (contém a proxy action) | ✅ Sim |
| `OWM_KEY` | Chave OpenWeatherMap (no servidor, via aba Keys) | ❌ |
| `WEATHERAPI_KEY` | Chave WeatherAPI (no servidor, via aba Keys) | ❌ |
| `NASA_FIRMS_KEY` | Chave gratuita NASA FIRMS | ❌ |
| `VITE_GROQ_API_KEY` | Chave Groq para LLM | ❌ |

> 💡 As chaves `OWM_KEY`, `WEATHERAPI_KEY` e `NASA_FIRMS_KEY` são lidas pela Convex Action (server-side) via `process.env`. Configure-as na aba **Keys/API keys** do Freebuff.

---

## 🐛 Correções Recentes

| # | Problema | Solução |
|---|----------|---------|
| 1 | Convex array > 8192 itens | `.slice(0, 500)` em todos os arrays retornados |
| 2 | CORS bloqueado (GDACS, NHC, Copernicus, etc.) | Proxy Convex server-side; CORS-blocked APIs removidas do fallback browser |
| 3 | Weather.gov 400 (`&limit=5`) | Parâmetro removido (não suportado) |
| 4 | INMET 404 (`/dados/{codigo}/{data}`) | Endpoint removido (mantido só `/estacao/`) |
| 5 | Mixed Content Cemaden (HTTP em HTTPS) | Fetch HTTP removido |
| 6 | Manifest (`logo.png` inexistente) | Alterado para `logo.svg` (arquivo existe) |
| 7 | Loop de polling concorrente | Trava `processandoRef` com delay de 500ms |
| 8 | Schema LLM rígido (só PT) | Validador flexível aceita PT + EN |
| 9 | Prompts Groq sem schema explícito | Few-shot com JSON schema no system prompt |

---

## 🤝 Contribuição

Áreas que podem ser melhoradas:

- **Histórico persistente**: salvar análises no Convex
- **App mobile**: versão PWA
- **Traduções**: suporte a mais idiomas
- **Previsão estendida**: modelos de ML para previsão de risco

---

## 📜 Licença

Projeto gratuito e open source. Desenvolvido com React, Convex, Tailwind CSS e integrações VLY.

---

<p align="center">
  Feito com ❤️ para ajudar comunidades a se prepararem para desastres naturais.
</p>
