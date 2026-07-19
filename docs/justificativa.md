# 1. Por que foi escolhido esse modelo/provedor?

O projeto utiliza o **Groq** com o modelo **Llama 3.3 70B**, escolhido pelos seguintes motivos:

## a) Latência ultrabaixa

A Groq utiliza chips próprios (**LPU – Language Processing Unit**) para inferência de modelos de linguagem, oferecendo tempos de resposta muito inferiores aos de outros provedores.

Enquanto modelos como GPT-4 ou Claude podem levar entre **5 e 15 segundos** para gerar uma resposta de aproximadamente 500 tokens, o Groq normalmente responde entre **200 e 600 ms**.

Em um sistema de **monitoramento e alerta de desastres naturais**, baixa latência é essencial para fornecer análises praticamente em tempo real.

## b) Baixo custo

A Groq disponibiliza um **Free Tier** com milhares de requisições diárias.

Como o sistema realiza consultas periódicas (polling) entre **2 e 10 minutos**, esse limite atende confortavelmente ao volume esperado de utilização, eliminando a necessidade de contratação de APIs pagas como OpenAI ou Anthropic.

## c) Boa capacidade de raciocínio técnico

O modelo **Llama 3.3 70B** apresenta desempenho suficiente para:

- interpretar dados geoespaciais;
- analisar informações meteorológicas;
- correlacionar eventos;
- gerar respostas estruturadas.

Modelos menores (7B–8B) tendem a apresentar maior taxa de alucinação, especialmente ao lidar com:

- coordenadas geográficas;
- distâncias;
- dados numéricos.

## d) Suporte nativo ao modo JSON

A API da Groq suporta:

```json
response_format: {
  "type": "json_object"
}
```

Esse recurso garante que a resposta seja um JSON válido, reduzindo erros de parsing e aumentando a confiabilidade da aplicação em produção.

---

# 2. Limitações do modelo escolhido

As principais limitações do **Llama 3.3 70B** executado na infraestrutura da Groq são apresentadas na tabela abaixo.

| Limitação | Impacto |
|-----------|---------|
| Janela de contexto limitada (8K tokens) | Em cenários com muitos eventos simultâneos pode ser necessário resumir ou truncar informações. |
| Ausência de Tool Calling | Os dados precisam ser enviados diretamente no prompt, impossibilitando consultas dinâmicas às APIs. |
| Sem suporte multimodal | Não interpreta imagens de satélite, radares meteorológicos ou mapas. |
| Streaming não utilizado | Embora a API suporte streaming, a implementação atual recebe toda a resposta apenas ao final da inferência. |
| Infraestrutura hospedada nos EUA | Usuários da América do Sul possuem latência adicional de aproximadamente 100–200 ms. |
| Limitação do Free Tier | Aproximadamente 30 requisições por minuto. Em caso de muitos usuários simultâneos pode ser necessário migrar para um plano pago. |
| Modelo exclusivamente textual | Toda análise depende da descrição enviada no prompt, sem compreensão direta de elementos visuais. |

---

# 3. O que mudaria utilizando GPT-4o ou Claude 3.5 Sonnet?

Caso o sistema fosse migrado para modelos de maior capacidade, como **GPT-4o** ou **Claude 3.5 Sonnet**, algumas funcionalidades poderiam ser ampliadas.

## Melhorias esperadas

- Contexto muito maior (128K tokens ou mais), permitindo enviar todo o histórico de eventos sem necessidade de resumo.
- Tool Calling nativo para que a própria IA escolha quais APIs consultar conforme o tipo de desastre identificado.
- Suporte multimodal para análise de:
  - imagens de satélite;
  - radares meteorológicos;
  - gráficos;
  - mapas.
- Melhor capacidade de raciocínio para distinguir situações complexas, como falsos alertas de tsunami e eventos reais.
- Melhor suporte multilíngue, dispensando parte das regras manuais de tradução e validação atualmente utilizadas.

## O que permaneceria igual

Mesmo utilizando modelos mais avançados, alguns componentes da arquitetura permaneceriam inalterados:

- arquitetura baseada em **Convex → APIs → LLM → Dashboard**;
- mecanismo determinístico de fallback (`analisarLocal`);
- utilização de baixa temperatura (`temperature = 0.1`) para minimizar alucinações.

---

# 4. É viável executar um modelo local?

Sim. A execução local é tecnicamente possível, porém envolve diversos compromissos.

## Cenários possíveis

### Llama 3.1 8B (quantizado)

- GPU de aproximadamente 8 GB VRAM;
- latência entre 2 e 5 segundos;
- menor qualidade de raciocínio geoespacial.

### Llama 3.3 70B (quantizado)

- GPUs de aproximadamente 48 GB VRAM;
- latência entre 5 e 15 segundos;
- qualidade próxima da versão em nuvem.

### Mistral Small 3.1 24B

- GPU de aproximadamente 24 GB;
- cerca de 3 segundos por inferência;
- bom equilíbrio entre desempenho e custo computacional.

---

## Principais perdas utilizando um modelo local

| Aspecto | Impacto |
|---------|---------|
| Latência | Respostas entre 2 e 15 segundos, significativamente superiores aos 200–600 ms obtidos na Groq. |
| Precisão | Modelos menores apresentam maior tendência a erros em coordenadas e cálculos de distância. |
| Garantia de JSON válido | Não há suporte nativo ao modo `json_object`, aumentando a possibilidade de erros de parsing. |
| Manutenção | Necessidade de administrar infraestrutura, modelos, quantização e atualizações. |
| Disponibilidade | Se o servidor local falhar, toda a análise deixa de funcionar. |
| Suporte multilíngue | Modelos menores possuem desempenho inferior em idiomas diferentes do inglês. |
| Consumo energético | GPUs podem consumir entre 150 W e 400 W durante inferências contínuas. |

---

# Conclusão

A execução local é totalmente viável utilizando ferramentas como **Ollama**, **llama.cpp** ou **vLLM**.

Entretanto, para uma aplicação de **monitoramento e alerta de desastres naturais**, onde rapidez, estabilidade e precisão são requisitos fundamentais, a utilização da **Groq** como serviço principal apresenta melhor relação entre desempenho, custo e confiabilidade.

Caso fosse necessária uma solução offline, uma abordagem recomendada seria utilizar:

- **Llama 3.1 8B** executado localmente;
- **lm-format-enforcer** para garantir respostas em JSON;
- mecanismo determinístico `analisarLocal` como camada adicional de segurança para validar resultados e reduzir possíveis alucinações do modelo.