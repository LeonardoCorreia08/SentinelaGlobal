# Guia de Instalação e Execução – SentinelaGlobal

## Passo 1: Clonar o projeto

Abra o terminal (CMD, PowerShell ou Git Bash) e escolha a pasta onde deseja armazenar o projeto.

Exemplo:

```bash
D:
cd \Project
git clone https://github.com/LeonardoCorreia08/SentinelaGlobal.git
cd SentinelaGlobal
```

---

## Passo 2: Instalar as dependências

Antes de continuar, certifique-se de que possui instalado:

- Node.js (inclui o npm)
- Python 3.x
- Git

### Instalar as dependências do Node.js

```bash
npm install
```

### Instalar as dependências do Python

```bash
pip install -r requirements.txt
```

---

## Passo 3: Configurar o Backend (Convex)

O projeto utiliza o **Convex** como backend.

### 1. Faça login no Convex

```bash
npx convex login
```

Uma janela do navegador será aberta para autenticação.

### 2. Inicie o servidor do Convex

```bash
npx convex dev
```

> **Importante:** mantenha este terminal aberto durante o desenvolvimento.

---

## Passo 4: Executar o Frontend (React)

Abra um **novo terminal** (sem fechar o anterior) e entre novamente na pasta do projeto.

```bash
cd D:\Project\SentinelaGlobal
npm run dev
```

---

## Passo 5: Acessar a aplicação

Após executar o comando anterior, será exibida uma saída semelhante a esta:

```text
➜  Local: http://localhost:5173/
```

Abra este endereço no navegador para acessar a aplicação.

---

# Configuração das Variáveis de Ambiente (.env)

Caso o projeto apresente erros como:

- `API key missing`
- `Environment variable not found`
- Erros de autenticação

é necessário configurar o arquivo `.env`.

## 1. Crie o arquivo

Na raiz do projeto, crie um arquivo chamado:

```text
.env
```

## 2. Caso exista um arquivo de exemplo

Se houver um arquivo chamado:

```text
.env.example
```

copie ou renomeie para:

```text
.env
```

## 3. Configure as variáveis

Preencha o arquivo com as chaves necessárias, como por exemplo:

- URL do Convex
- Chave da API da Groq
- Outras APIs utilizadas pelo projeto

Exemplo:

```env
VITE_CONVEX_URL=sua_url
GROQ_API_KEY=sua_chave
OUTRA_VARIAVEL=valor
```

> **Observação:** utilize sempre suas chaves reais. Nunca envie o arquivo `.env` para repositórios públicos.

---

# Estrutura de Execução

Mantenha dois terminais abertos:

### Terminal 1

Responsável pelo backend (Convex).

```bash
npx convex dev
```

### Terminal 2

Responsável pelo frontend (React).

```bash
npm run dev
```

---

# Tecnologias Utilizadas

- React
- Vite
- Convex
- Node.js
- Python
- npm

---

# Solução de Problemas

### O projeto não abre

Verifique se:

- Node.js está instalado.
- As dependências foram instaladas com `npm install`.
- O servidor Convex está em execução (`npx convex dev`).
- O arquivo `.env` foi criado corretamente.

### Erro de API

Confira se todas as variáveis do `.env` foram preenchidas corretamente.

### Porta ocupada

Caso a porta `5173` esteja em uso, o Vite informará outra porta disponível no terminal. Basta abrir o endereço informado.