# Critérios de Avaliação

### 1. System Prompt e Estratégia de Prompting

O desenvolvimento do Sentinela Global utilizou uma estratégia de prompting baseada em papéis (Role Prompting), instruções explícitas e refinamento iterativo. Desde o início, o modelo foi instruído a atuar como um **Engenheiro de Software Full Stack Sênior e Especialista em Monitoramento de Desastres Naturais**, mantendo um comportamento consistente durante toda a geração do sistema.

Para facilitar a manutenção, evolução e reutilização dos prompts, eles foram organizados em arquivos separados, cada um responsável por uma etapa específica da interação com o modelo:

```text
prompts/
├── system_prompt.txt          # Persona, regras e comportamento do modelo
├── monitoramento.txt          # Análise dos eventos monitorados
├── classificacao_risco.txt    # Critérios para classificação do risco
├── alerta_usuario.txt         # Geração das mensagens de alerta
├── few_shot_examples.txt      # Exemplos utilizados para orientar o modelo
└── output_schema.json         # Estrutura esperada das respostas em JSON
```

Essa organização permitiu versionar os prompts individualmente, realizar refinamentos sem impactar outras funcionalidades e facilitar futuras manutenções do sistema.

O system prompt definiu claramente a persona do modelo, o objetivo do projeto, as restrições arquiteturais e o formato esperado das respostas. Sempre que possível, foi solicitado que o modelo gerasse código modular, documentado e organizado, seguindo boas práticas de desenvolvimento.

Ao longo do projeto, os prompts foram refinados de forma incremental. Em vez de solicitar toda a aplicação em uma única interação, o desenvolvimento foi dividido em módulos independentes, permitindo validar cada funcionalidade antes de avançar para a próxima etapa.

Também foram utilizadas técnicas de engenharia de prompts, como:

- Role Prompting (definição da persona);
- Prompting incremental;
- Structured Outputs (respostas estruturadas em JSON);
- Few-Shot Prompting;
- Separação dos prompts por responsabilidade (Prompt Modular).

Essa abordagem reduziu ambiguidades, aumentou a consistência das respostas e facilitou a implementação das funcionalidades do sistema.



# 2. Ferramentas (Tools) e Integração

O Sentinela Global foi desenvolvido utilizando uma arquitetura baseada na integração de múltiplas ferramentas especializadas.

Para o monitoramento de desastres naturais foram utilizadas APIs públicas como USGS, NOAA, NASA FIRMS, GDACS, Open-Meteo, INMET e outras fontes oficiais, permitindo coletar informações em tempo real sobre terremotos, enchentes, queimadas, tempestades e demais eventos ambientais.

No backend foi utilizado o Convex, responsável pelo gerenciamento de dados, autenticação e execução das funções serverless. A utilização do Convex eliminou a necessidade de manter um servidor dedicado, simplificando a arquitetura e reduzindo custos de infraestrutura.

A camada de Inteligência Artificial foi integrada utilizando a API da Groq com o modelo Llama 3.3 70B, responsável por interpretar os dados recebidos, calcular o nível de risco e gerar recomendações em linguagem natural.

Cada ferramenta possui uma responsabilidade específica dentro do sistema, permitindo uma arquitetura modular, escalável e de fácil manutenção. Essa separação também facilita futuras substituições ou integrações com novas APIs sem impactar os demais componentes da aplicação.



## 3. Escolha e Configuração de Parâmetros

Para a geração das análises foi escolhido o modelo **Llama 3.3 70B**, disponibilizado pela Groq, devido à sua baixa latência, boa capacidade de raciocínio e suporte à geração de respostas estruturadas.

A temperatura foi configurada em **0.1**, priorizando respostas consistentes e reduzindo a ocorrência de alucinações, aspecto essencial em um sistema de monitoramento de riscos.

Durante o desenvolvimento foram avaliadas diferentes configurações de temperatura. Valores mais elevados produziram respostas mais criativas, porém menos determinísticas, enquanto valores próximos de zero apresentaram maior estabilidade e repetibilidade, sendo mais adequados para análises técnicas.

Além da temperatura, foram utilizadas respostas estruturadas em JSON sempre que necessário, facilitando o processamento das informações pelo sistema e reduzindo erros de interpretação.

A escolha dos parâmetros teve como principal objetivo equilibrar precisão, desempenho e confiabilidade nas respostas geradas pela IA.

### Experimentos realizados

Durante o desenvolvimento foram realizados testes com diferentes valores de temperatura para avaliar o impacto na qualidade das respostas.

| Experimento | Temperatura | Resultado |
|-------------|------------:|-----------|
| Teste 1 | **0.0** | Respostas muito consistentes, porém excessivamente rígidas. |
| Teste 2 | **0.1** ✅ | Melhor equilíbrio entre precisão e estabilidade. Valor adotado no projeto. |
| Teste 3 | **0.3** | Respostas mais naturais, mas com pequenas variações nas classificações. |
| Teste 4 | **0.7** | Maior criatividade, porém aumento de inconsistências e alucinações. Não recomendado para monitoramento de riscos. |

### Comparação entre modelos

Também foi realizada uma análise comparativa entre diferentes modelos de linguagem considerando desempenho, custo e adequação ao projeto.

| Modelo | Avaliação |
|---------|-----------|
| **Llama 3.3 70B (Groq)** ✅ | Melhor equilíbrio entre velocidade, custo e precisão. Modelo adotado no projeto. |
| GPT-4o | Excelente capacidade de raciocínio, porém custo superior. |
| Claude 3.5 Sonnet | Bom desempenho em tarefas complexas, porém não foi utilizado devido ao custo e à integração. |
| Llama 3.1 8B (Local) | Alternativa viável para execução local, porém com menor precisão em análises geoespaciais. |



# 4. Arquitetura e Escolha de Framework

A arquitetura do projeto foi desenvolvida utilizando React para o frontend e Convex como backend serverless, permitindo uma aplicação moderna, escalável e de baixa complexidade operacional.

Inicialmente foi considerada uma arquitetura baseada em FastAPI, porém essa abordagem mostrou-se incompatível com o ambiente de execução utilizado durante o desenvolvimento. Após essa avaliação, optou-se pela utilização exclusiva de Convex Actions, eliminando dependências de servidores externos e simplificando o fluxo da aplicação.

A integração com o modelo de linguagem foi realizada por meio da API da Groq, sem a utilização de frameworks intermediários como LangChain ou LlamaIndex. Essa decisão proporcionou maior controle sobre os prompts, menor complexidade de implementação e redução da latência das requisições.

A arquitetura final é composta por quatro camadas principais:

- Interface do usuário (React);
- Backend serverless (Convex);
- APIs de monitoramento de desastres;
- Modelo de linguagem responsável pela análise inteligente.

Essa organização tornou o sistema modular, facilitando futuras evoluções e integrações.



# 5. README e Documentação

O README foi elaborado com foco nas decisões de engenharia relacionadas ao uso de Inteligência Artificial.

A documentação apresenta a descrição do problema abordado pelo sistema, a arquitetura utilizada, o fluxo de funcionamento da IA, as ferramentas integradas e as justificativas para cada decisão técnica adotada durante o desenvolvimento.

Também foram documentadas as escolhas do modelo de linguagem, dos parâmetros utilizados, da arquitetura serverless e das APIs externas responsáveis pelo monitoramento dos eventos.

Além disso, o README descreve os principais desafios encontrados durante o desenvolvimento, as limitações observadas, as soluções adotadas e os aprendizados obtidos com o uso do agente de codificação.

