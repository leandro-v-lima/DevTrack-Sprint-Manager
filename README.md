# DevTrack Sprint Manager — Versão Web

Aplicação de gestão de tarefas de desenvolvimento. Frontend puro (HTML + CSS + Vanilla JS) com Supabase como banco de dados e Vercel para hosting — **sem custo**.

---

## Pré-requisitos 

- Navegador moderno (Chrome, Edge, Firefox, Safari)
- Conta gratuita no [Supabase](https://supabase.com) (banco de dados)
- Conta gratuita no [Vercel](https://vercel.com) (hosting)
- Conta no [GitHub](https://github.com) (para conectar ao Vercel)

---

## Parte 1 — Configurar o Banco de Dados (Supabase)

### 1.1 Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **Start your project**
2. Faça login com GitHub ou e-mail
3. Clique em **New Project**
4. Preencha:
   - **Name:** `devtrack`
   - **Database Password:** crie uma senha forte (guarde-a)
   - **Region:** escolha a mais próxima (ex: South America - São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

### 1.2 Executar o schema SQL

1. No painel do Supabase, clique em **SQL Editor** (ícone de banco no menu lateral)
2. Clique em **New query**
3. Abra o arquivo `database/schema.sql` deste projeto
4. Copie todo o conteúdo e cole no editor
5. Clique em **Run** (ou `Ctrl+Enter`)
6. Aguarde a mensagem `Success. No rows returned`

Isso irá criar:
- Tabela `tasks` com 10 tarefas de exemplo
- Tabela `users_devtrack` com 9 usuários de exemplo
- Tabela `releases` com 5 releases de exemplo
- Tabela `import_logs`
- Políticas de acesso (RLS)
- Trigger para `updated_at`

### 1.3 Obter as credenciais do Supabase

1. No painel do Supabase, acesse **Settings → API** (engrenagem no menu lateral)
2. Copie:
   - **Project URL** → ex: `https://abcxyzabc.supabase.co`
   - **anon public** (em "Project API keys") → chave longa começando com `eyJ...`

---

## Parte 2 — Configurar o Projeto

### 2.1 Inserir as credenciais no código

Abra o arquivo `assets/js/app.js` e substitua as linhas no topo:

```javascript
// ANTES
const SUPABASE_URL      = "SUA_URL_AQUI";
const SUPABASE_ANON_KEY = "SUA_CHAVE_AQUI";

// DEPOIS (exemplo)
const SUPABASE_URL      = "https://abcxyzabc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

> **Nota de segurança:** A chave `anon` é pública por design no Supabase. Ela é protegida pelas políticas de RLS configuradas no schema. Não use a chave `service_role` aqui.

---

## Parte 3 — Testar Localmente

Você pode testar antes de publicar. Como o projeto é HTML puro, basta servir os arquivos:

**Opção A — VS Code (extensão Live Server):**
1. Abra a pasta `projeto_web` no VS Code
2. Clique com botão direito em `index.html` → **Open with Live Server**

**Opção B — Python (qualquer versão):**
```bash
cd projeto_web
python -m http.server 8080
# Abra http://localhost:8080
```

**Opção C — Node.js (npx):**
```bash
cd projeto_web
npx serve .
# Abra a URL indicada no terminal
```

**Credenciais de acesso (exemplo):**
| Usuário | Senha |
|---|---|
| Alexandre | abc123 |
| Bruno | abc123 |
| leandro.lima | Lesao@123 |

> Se o Supabase não estiver configurado, o sistema inicia em **modo memória** com os dados de exemplo do `constants.js`. Os dados não serão persistidos entre recarregamentos da página.

---

## Parte 4 — Publicar no Vercel (Deploy Gratuito)

### 4.1 Subir o código para o GitHub

1. Crie um repositório no GitHub (pode ser privado)
2. Faça o upload dos arquivos da pasta `projeto_web`:

```bash
cd projeto_web
git init
git add .
git commit -m "feat: DevTrack Sprint Manager versão web"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/devtrack-web.git
git push -u origin main
```

### 4.2 Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New → Project**
3. Selecione o repositório `devtrack-web`
4. Na tela de configuração:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (deixe padrão)
   - **Build Command:** deixe em branco (não é necessário — é HTML puro)
   - **Output Directory:** deixe em branco
5. Clique em **Deploy**
6. Aguarde ~30 segundos

Após o deploy, você receberá uma URL pública como:
`https://devtrack-web-xxx.vercel.app`

### 4.3 Deploy automático

A cada `git push` para a branch `main`, o Vercel publica automaticamente a nova versão.

---

## Estrutura de Arquivos

```
projeto_web/
├── index.html              ← Aplicação completa (SPA)
├── assets/
│   ├── css/
│   │   └── style.css       ← Design system dark mode
│   └── js/
│       ├── constants.js    ← Configurações e dados estáticos
│       ├── helpers.js      ← Utilitários (com bugfix devHours/qaHours)
│       ├── uiComponents.js ← Renderização de views
│       ├── csvHandler.js   ← Importação de CSV
│       ├── supabaseProvider.js  ← DataProvider (Supabase + fallback)
│       └── app.js          ← Controlador + credenciais do Supabase
├── database/
│   └── schema.sql          ← Execute no SQL Editor do Supabase
├── docs/
│   ├── analise_projeto.md  ← Análise completa do projeto original
│   └── documentacao.md    ← Documentação técnica
└── README.md               ← Este arquivo
```

---

## Observações Importantes

### Sobre o modo memória (sem Supabase)
Se `SUPABASE_URL` não for configurado, o app funciona normalmente mas os dados ficam apenas em memória RAM. Ao recarregar a página, os dados voltam ao estado inicial. Isso é útil para testes locais rápidos.

### Sobre autenticação
O sistema usa autenticação própria (tabela `users_devtrack`) por compatibilidade com o projeto original. **Não** utiliza o Supabase Auth. As senhas são armazenadas em texto puro — adequado para ferramenta interna. Para produção com dados sensíveis, implemente hashing de senhas (ex: bcrypt via Edge Function do Supabase).

### Sobre custos
- **Supabase Free Tier:** 500 MB de banco, 50.000 requests/mês, 2 projetos
- **Vercel Free Tier:** deploys ilimitados, 100 GB de banda/mês, domínio `.vercel.app` gratuito
- Ambos suficientes para uso de equipes pequenas (até ~10 desenvolvedores)

### Sobre a chave anon do Supabase
A chave `anon` aparece no código frontend — isso é o comportamento esperado e seguro, desde que as políticas RLS estejam ativas (já configuradas no `schema.sql`). Ela permite operações apenas nas tabelas autorizadas.

### Customização
Para alterar usuários, releases, cores ou dados iniciais, edite `assets/js/constants.js` e execute novamente as seções `INSERT` do `schema.sql` no Supabase.
