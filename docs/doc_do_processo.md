### 4. README — Documentação do Processo

| Critério |
|----------|
| **Descrição do problema e da solução proposta** — O que o sistema faz? Qual problema resolve? Como a IA será integrada no futuro? |


O **Sentinela Global** é um sistema inteligente de monitoramento de riscos e desastres naturais em tempo real. A plataforma centraliza informações provenientes de diversas fontes confiáveis, como USGS, NOAA, NASA, GDACS e INMET, para identificar eventos como terremotos, enchentes, incêndios, tempestades e deslizamentos, relacionando essas ocorrências à localização do usuário.

O sistema busca resolver o problema da dispersão de informações sobre desastres naturais, que atualmente estão distribuídas em diferentes plataformas e dificultam uma análise rápida e eficiente. Ao reunir esses dados em um único ambiente, o Sentinela Global fornece uma visão integrada da situação, permitindo maior conscientização e apoio à tomada de decisão.

Como solução, a aplicação apresenta um painel interativo com mapas, indicadores de risco, eventos próximos e alertas em tempo real, oferecendo ao usuário uma visão clara do cenário ao seu redor.

A Inteligência Artificial é integrada para analisar os eventos coletados, interpretar o contexto dos dados e gerar análises e recomendações de forma automatizada. Em versões futuras, a IA poderá incorporar novas fontes de informação, realizar análises preditivas e utilizar modelos mais avançados para aumentar a precisão e a confiabilidade dos alertas emitidos.

| Critério |
|----------|
| **Escolhas de design** — Por que essa arquitetura? Por que esses componentes de UI? Que alternativas foram consideradas? |

## Escolhas de design

A arquitetura do **Sentinela Global** foi desenvolvida com foco em modularidade, escalabilidade e facilidade de manutenção. A separação entre frontend, backend, serviços de monitoramento e módulo de Inteligência Artificial permite que cada componente evolua de forma independente, facilitando futuras integrações com novas APIs e funcionalidades.

No frontend, foram escolhidos **React**, **Tailwind CSS** e **Leaflet** por oferecerem uma interface moderna, responsiva e intuitiva. O mapa interativo é o principal elemento visual da aplicação, pois permite ao usuário identificar rapidamente sua localização e os eventos de risco ao seu redor. Componentes como indicadores de risco, gráficos e cartões de informações foram adotados para facilitar a compreensão dos dados e melhorar a experiência do usuário.

No backend, a utilização do **Convex** e de uma arquitetura baseada em serviços possibilita atualizações em tempo real, gerenciamento eficiente dos dados e integração simplificada com diferentes fontes de monitoramento.

Como alternativas, foram considerados frameworks como **Angular** e **Vue.js** para o frontend, além de bibliotecas de mapas como **Mapbox** e **Google Maps**. Entretanto, optou-se por React devido ao seu amplo ecossistema, pela facilidade de reutilização de componentes e pela integração com Leaflet, que oferece uma solução de código aberto adequada às necessidades do projeto.


| Critério |
|----------|
| **O que funcionou** — Quais partes o agente de codificação gerou bem? Onde a experiência foi positiva? Exemplos específicos de prompts que deram bons resultados |

A experiência com o agente de codificação foi bastante positiva na implementação de funcionalidades específicas, na geração de código e na resolução de problemas técnicos. Em diversos momentos, o agente produziu soluções completas com poucas interações, acelerando significativamente o desenvolvimento do projeto.

Um dos melhores resultados foi a implementação do sistema de notificações inteligentes. A partir do prompt:

> **"Melhorar o sistema de notificações com som de alerta e notificação do navegador quando risco > 80%."**

o agente integrou a **Web Audio API** e a **Notification API**, criando um sistema de alertas visuais e sonoros eficiente, além de implementar um mecanismo de deduplicação para evitar notificações repetidas durante o monitoramento.

Outro destaque foi a correção de problemas relacionados ao **TypeScript**. O agente identificou inconsistências de tipagem, ajustou propriedades incompatíveis e aplicou asserções de tipo quando necessário, permitindo que o projeto fosse compilado corretamente.

Também apresentou bom desempenho no refinamento de fluxos assíncronos, substituindo implementações menos adequadas por abordagens utilizando **async/await**, tornando o código mais organizado, legível e confiável.

De forma geral, o agente foi eficiente na construção da interface, na integração entre componentes do frontend e na implementação de funcionalidades baseadas em APIs do navegador. Os melhores resultados foram obtidos com prompts objetivos e bem contextualizados, que definiam claramente o comportamento esperado.

| Critério |
|----------|
| **O que não funcionou** — Onde o agente falhou? O que precisou de intervenção manual? Quais limitações foram encontradas? O que seria feito diferente? |

A principal dificuldade encontrada foi relacionada à definição inicial da arquitetura do projeto. O agente gerou uma estrutura baseada em **FastAPI**, incompatível com o ambiente serverless utilizado, o que exigiu intervenção manual para adequar a solução à infraestrutura baseada em **Convex Actions**.

Também foram observadas limitações no gerenciamento do estado da **Notification API**. Em alguns momentos, a lógica implementada disparava notificações repetidamente, sendo necessário realizar ajustes para controlar corretamente o envio dos alertas.

Outra limitação ocorreu durante o desenvolvimento de um projeto de maior porte. Conforme o contexto da conversa aumentava, o agente passou a perder referência de partes implementadas anteriormente, sugerindo alterações que ocasionalmente afetavam funcionalidades já concluídas.

### Limitações encontradas

- O limite diário de mensagens dificultou a continuidade do desenvolvimento quando foram necessárias diversas interações para corrigir problemas arquiteturais.

- Em alguns momentos, o agente não reconheceu automaticamente as restrições do ambiente de execução, sugerindo soluções incompatíveis com a arquitetura serverless utilizada no projeto.

- Em conversas longas, houve perda parcial de contexto, exigindo que informações importantes fossem reapresentadas em novos prompts.

### O que seria feito diferente

Em uma nova implementação, a stack tecnológica seria definida completamente antes do início do desenvolvimento, deixando explícitas as limitações do ambiente e as tecnologias obrigatórias do projeto.

Além disso, os prompts seriam divididos em módulos menores e independentes, permitindo validar cada funcionalidade antes de avançar para a próxima etapa, reduzindo perda de contexto e retrabalho.

Por fim, seria realizada uma validação prévia da compatibilidade entre as soluções propostas pelo agente e o ambiente de execução, evitando implementações incompatíveis e tornando o processo de desenvolvimento mais eficiente.
