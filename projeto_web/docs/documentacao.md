# Documentação — DevTrack Sprint Manager (Versão Web)

---

## 1. Visão Geral do Sistema

O **DevTrack Sprint Manager** é uma aplicação web de gestão de tarefas de desenvolvimento de software. Ela permite que equipes de desenvolvimento acompanhem o progresso de tickets, releases, alocação de desenvolvedores e importações de sistemas externos.

A versão web foi construída como **frontend puro (HTML + CSS + Vanilla JS)** com **Supabase** como banco de dados PostgreSQL hospedado na nuvem e **Vercel** para hosting — ambos com plano gratuito, sem custo de infraestrutura.

---

## 2. Lista de Funcionalidades Implementadas

| # | Funcionalidade | View |
|---|---|---|
| 1 | Login com usuário e senha | Login |
| 2 | Logout com limpeza de sessão | Topbar |
| 3 | KPIs pessoais clicáveis (Minhas Tarefas, Concluídas, Em Andamento, Bloqueadas) | Homepage |
| 4 | Barras de progresso por status (tarefas do usuário logado) | Homepage |
| 5 | Resumo de horas (Dev, QA, Capacidade, % Utilização) | Homepage |
| 6 | Lista das 5 tarefas filtradas pelo KPI selecionado | Homepage |
| 7 | KPIs gerais da equipe | Dashboard |
| 8 | Barras de progresso por status (equipe) | Dashboard |
| 9 | Barras de progresso por release (% concluído + horas + deadline) | Dashboard |
| 10 | Cards de alocação por desenvolvedor (% capacidade com semáforo de cores) | Dashboard |
| 11 | Board Kanban com 6 colunas (uma por status) | Kanban |
| 12 | Cards com ID, tipo, descrição, cliente, prioridade e avatar do dev | Kanban |
| 13 | Drag & Drop entre colunas para atualizar status | Kanban |
| 14 | Tag de origem (CSV/API) nos cards | Kanban |
| 15 | Tabela sortável por qualquer coluna (11 colunas) | Backlog |
| 16 | Indicadores de ordenação (↑↓) nos headers | Backlog |
| 17 | Badges coloridos por status, prioridade, tipo e origem | Backlog |
| 18 | Busca por texto (ID, descrição, cliente) | Filtros |
| 19 | Filtros por Status, Dev, Release e Tipo | Filtros |
| 20 | Contador "X de Y tarefas" | Filtros |
| 21 | Modal de criação/edição de tarefas (todos os campos) | Modal |
| 22 | Cálculo automático de total de horas (DEV + QA) | Modal |
| 23 | Modal de criação de release | Modal |
| 24 | Modal de criação/edição de usuário | Modal |
| 25 | Tabela de usuários com editar e excluir | Usuários |
| 26 | Importação de CSV com auto-detecção de delimitador | Integrações |
| 27 | Mapeamento inteligente de colunas (fuzzy matching) | Integrações |
| 28 | Normalização de status e tipo no CSV | Integrações |
| 29 | Preview antes de confirmar importação | Integrações |
| 30 | Deduplicação por origemId (CSV e API) | Integrações |
| 31 | Simulação de teste de conexão com API | Integrações |
| 32 | Sincronização mock com API | Integrações |
| 33 | Toggle de polling automático com intervalo configurável | Integrações |
| 34 | Histórico de importações (últimas 20) | Integrações |
| 35 | Guia explicativo de como funciona | Integrações |
| 36 | Badge numérico no botão Integrações (tickets importados) | Topbar |
| 37 | KPIs de origem (Manual / CSV / API) | Integrações |

---

## 3. Estrutura de Pastas

```
projeto_web/
├── index.html                  ← Página única (SPA)
├── assets/
│   ├── css/
│   │   └── style.css           ← Design system completo (dark mode)
│   └── js/
│       ├── constants.js        ← Configurações, cores e dados iniciais
│       ├── helpers.js          ← 16 funções utilitárias puras
│       ├── uiComponents.js     ← Renderização de Kanban, Backlog, Dashboard
│       ├── csvHandler.js       ← Parser e preview de CSV
│       ├── supabaseProvider.js ← DataProvider com Supabase + fallback memória
│       └── app.js              ← Controlador principal + bootstrap
├── database/
│   └── schema.sql              ← Script completo de criação do banco
├── docs/
│   ├── analise_projeto.md      ← Análise do projeto original (Fase 1)
│   └── documentacao.md        ← Este arquivo
└── README.md                   ← Guia de instalação e deploy
```

---

## 4. Descrição dos Arquivos Principais

### `index.html`
Única página HTML da aplicação (SPA). Contém todas as views (login, homepage, dashboard, kanban, backlog, integrações, usuários) e o modal. As views são ocultadas/exibidas via classe CSS `.active`. Carrega os scripts na ordem correta de dependência.

### `assets/css/style.css`
Sistema de design completo baseado em variáveis CSS. Dark mode por padrão. Responsivo (mobile-first). Contém estilos para todas as views, componentes (kanban cards, badges, avatares, modais, tabelas, botões) e media queries.

### `assets/js/constants.js`
Configuração central da aplicação: lista de usuários, devs, horas disponíveis, releases, status, tipos, classificações, módulos, estilos de cor e tarefas de exemplo (INITIAL_TASKS). Altere aqui para customizar sem tocar na lógica.

### `assets/js/helpers.js`
16 funções utilitárias puras (sem efeitos colaterais): `avatarHTML`, `badge`, `setSelect`, `showAlert`, `sleep`, `padZero`, `formatDate`, `formatTime`, `calcDevCapacity`, `copyToClipboard`, `isValidEmail`, `getColorByStatus`, `getColorByType`, `sortBy`, `uniqueBy`, `groupBy`, `getStats`. **Contém correção do bug `devHours`/`qaHours`.**

### `assets/js/uiComponents.js`
Classe estática com métodos de renderização: `renderKanban`, `renderBacklog`, `renderDashboard`, `updateIntegKpis`, `updateNavBadge`. Recebe dados e injeta HTML puro no DOM. Sem estado próprio.

### `assets/js/csvHandler.js`
Classe estática para importação de CSV: `parseCSV` (auto-detecção de delimitador), `csvRowToTask` (normalização com fuzzy matching), `renderPreview` (tabela com deduplicação visual), `cancelPreview`.

### `assets/js/supabaseProvider.js`
Implementação do DataProvider usando Supabase JS Client v2. Opera em dois modos:
- **Modo Supabase**: persiste dados no PostgreSQL na nuvem
- **Modo Memória (fallback)**: quando não configurado ou sem conexão, usa dados em memória (dados não persistem entre sessões)

### `assets/js/app.js`
Controlador principal (`DevTrackApp`). Gerencia estado, eventos, views, modal e login. Configuração do Supabase (`SUPABASE_URL` e `SUPABASE_ANON_KEY`) fica no topo deste arquivo.

---

## 5. Modelo do Banco de Dados

### Tabela `tasks`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | BIGINT PK | ID único da tarefa |
| ticket_orc | TEXT | Número do ticket de orçamento |
| horas_dev | INTEGER | Horas estimadas de desenvolvimento |
| horas_qa | INTEGER | Horas estimadas de QA |
| tipo | TEXT | NOVA FEATURE / DÉBITO TÉCNICO / VULNERABILIDADE / CUSTOMIZAÇÃO |
| classif | TEXT | Evolução / Customização |
| modulo | TEXT | Módulo do sistema afetado |
| cliente | TEXT | Nome do cliente |
| descricao | TEXT | Descrição da tarefa |
| release | TEXT | Versão da release associada |
| prioridade | TEXT | Alta / Média / Baixa |
| status | TEXT | Status atual (ver STATUS_LIST) |
| dev | TEXT | Desenvolvedor responsável |
| demandante | TEXT | Quem demandou |
| data_reg | TEXT | Data de registro (dd/mm/yyyy) |
| origem | TEXT | manual / csv / api |
| origem_id | TEXT | ID no sistema externo (para deduplicação) |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Data da última atualização (atualizado por trigger) |

### Tabela `users_devtrack`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | SERIAL PK | ID auto-incremento |
| username | TEXT UNIQUE | Login do usuário |
| name | TEXT | Nome de exibição |
| password | TEXT | Senha (plaintext para compatibilidade) |
| horas_disponivel | INTEGER | Horas disponíveis por mês |
| role | TEXT | user / admin |
| active | BOOLEAN | Ativo/inativo |
| created_at | TIMESTAMPTZ | Data de criação |

### Tabela `releases`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | TEXT PK | Versão (ex: 7.14.0) |
| produto | TEXT | Enterprise / CLM / ElawOn |
| data_inicio | TEXT | Data de início |
| data_fim | TEXT | Data de entrega prevista |
| status | TEXT | Planejado / Em Andamento / Concluído |
| created_at | TIMESTAMPTZ | Data de criação |

### Tabela `import_logs`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | SERIAL PK | ID auto-incremento |
| tipo | TEXT | csv / api |
| total | INTEGER | Total de tickets processados |
| adicionados | INTEGER | Quantos foram adicionados |
| duplicatas | INTEGER | Quantos foram ignorados |
| created_at | TIMESTAMPTZ | Timestamp do log |

---

## 6. Bugs Corrigidos

### Bug #1 — `getStats()` não retornava `devHours` e `qaHours`

**Arquivo original:** `src/utils/helpers.js` (linha 191)
**Arquivo corrigido:** `assets/js/helpers.js`

**Antes (original):**
```javascript
return {
  total,
  completed,
  completionRate: ...,
  inProgress,
  blocked,
  totalHours,         // soma de dev + qa juntos
  hoursCompleted,
  // devHours e qaHours NÃO existiam
};
```

**Depois (corrigido):**
```javascript
const devHours = tasks.reduce((a, t) => a + (t.horasDev || 0), 0);
const qaHours  = tasks.reduce((a, t) => a + (t.horasQa  || 0), 0);

return {
  total,
  completed,
  completionRate: ...,
  inProgress,
  blocked,
  devHours,       // ← ADICIONADO
  qaHours,        // ← ADICIONADO
  totalHours: devHours + qaHours,
  hoursCompleted,
};
```

**Impacto:** O resumo de horas na Homepage exibia `undefinedh` nos campos "Dev (estimada)" e "QA (estimada)". Agora exibe os valores corretos.
