# Análise do Projeto Original — DevTrack Sprint Manager

Gerado automaticamente durante a Fase 1 da migração.

---

## 1. Lista Completa de Funcionalidades Mapeadas

### Autenticação
- Tela de login com usuário + senha
- Validação de credenciais contra lista de usuários (originalmente em memória / Excel)
- Logout com limpeza de sessão
- Após login, exibe nome do usuário na Homepage ("Bem-vindo, {nome}!")

### Homepage (visão pessoal do dev logado)
- KPIs clicáveis: Minhas Tarefas, Concluídas, Em Andamento, Bloqueadas
- Cada KPI filtra a lista de tarefas ao ser clicado
- Barras de progresso por status (tarefas do usuário logado)
- Resumo de horas: Dev estimada, QA estimada, Capacidade, % Utilização
- Lista das 5 tarefas mais recentes filtradas pelo status selecionado
- Clicar em uma tarefa abre o modal de edição

### Dashboard (visão geral da equipe)
- 4 KPIs: Total de Tarefas, Concluídas, Em Andamento, Bloqueadas
- Barras de progresso por status (% do total)
- Barras de progresso por Release (tarefas concluídas/total + horas + data de entrega)
- Cards de alocação por desenvolvedor (horas DEV, horas QA, % capacidade com cor semafórica)

### Kanban
- 6 colunas correspondendo aos 6 status: Planejado, Em Desenvolvimento, Em Homologação - QA, Em Homologação - Cliente, Concluído, Bloqueado
- Cards com: ID, ícone do tipo, descrição, cliente, badge de prioridade, avatar do dev
- Drag & Drop entre colunas (atualiza status da tarefa ao soltar)
- Tag de origem (CSV / API) nos cards
- Clicar no card abre modal de edição

### Backlog
- Tabela com 11 colunas: ID, Tipo, Prioridade, Status, Dev, Release, Cliente, H.Dev, H.QA, Origem, Descrição
- Ordenação clicável por qualquer coluna (asc/desc)
- Badges coloridos por status, prioridade e tipo
- Avatar do dev com iniciais
- Clicar em linha abre modal de edição

### Filtros (barra de filtros global)
- Busca por texto (ID, descrição, cliente)
- Dropdown: Status, Dev, Release, Tipo
- Contador "X de Y tarefas"
- Filtros aplicam em Kanban, Backlog e Dashboard simultaneamente

### Modal de Tarefa
- Editar tarefa existente ou criar nova
- Campos: Descrição (textarea), Cliente, Demandante, Ticket Orçamento, Data Registro
- Estimativa de Horas: DEV + QA + Total (calculado automaticamente)
- Dropdowns: Status, Desenvolvedor, Release, Prioridade, Tipo, Classificação, Módulo
- Badge com tipo e origem (CSV/API) no header do modal
- Botões: Excluir (tarefa existente), Cancelar, Salvar / Criar Tarefa

### Modal de Release
- Criar nova release com: ID, Produto, Data Início, Data Fim, Status
- Validação de campos obrigatórios
- Release criada aparece imediatamente nos dropdowns e no dashboard

### Modal de Usuário
- Criar novo usuário ou editar existente via modal
- Campos: Login, Nome, Senha, Horas Disponíveis, Função (user/admin), Ativo/Inativo
- Validação de campos obrigatórios e unicidade de username

### Gestão de Usuários (view)
- Tabela listando todos os usuários com: Login, Nome, Role, Horas, Status
- Botões Editar e Excluir por linha
- Botão "+ Novo Usuário" abre modal

### Integração — Importação CSV
- Upload de arquivo .csv, .txt ou .tsv
- Auto-detecção de delimitadores: vírgula, ponto-e-vírgula, pipe, tab
- Mapeamento inteligente de colunas (fuzzy matching de headers)
- Normalização de status ("em atendimento" → "Em Desenvolvimento", etc.)
- Normalização de tipo ("BUG" → "DÉBITO TÉCNICO", etc.)
- Fuzzy match de nome de desenvolvedor
- Preview antes de confirmar importação (com indicação de duplicatas)
- Deduplicação por origemId ao confirmar

### Integração — API (simulada)
- Formulário com URL base, API Key e intervalo de polling
- Botão "Testar Conexão" (simulado com delay)
- Botão "Sincronizar Agora" (traz 2 tickets mock de exemplo)
- Toggle de polling automático com intervalo configurável (minutos)
- Deduplicação por origemId igual à importação CSV

### Integração — Histórico
- Log das últimas 20 importações (CSV ou API)
- Cada entrada mostra: tipo, total processados, adicionados, duplicatas, horário

### Integração — Como Funciona
- Guia explicativo sobre importação CSV e integração API

### Badge de Integrações
- Botão "Integrações" na navbar exibe badge com contagem de tickets importados (CSV + API)

### KPIs de Integrações
- Contadores no header da view: Manual, Via CSV, Via API

---

## 2. Fluxos e Regras de Negócio

### Fluxo de Login
1. Usuário informa login + senha
2. Sistema valida contra lista de usuários (DataProvider.validateUserCredentials)
3. Se válido: exibe topbar, filterbar, content; redireciona para Homepage
4. Se inválido: exibe mensagem de erro inline

### Fluxo de Criação de Tarefa
1. Clique em "Nova Tarefa" → modal com ID aleatório (150000-160000)
2. Preencher campos → "Criar Tarefa" → task adicionada ao array em memória
3. Re-render de todas as views

### Fluxo de Edição via Drag & Drop
1. Card arrastado de coluna origem para coluna destino
2. `task.status` atualizado para o status da coluna destino
3. `dataProvider.saveTask()` chamado (mesmo que falhe, UI continua)
4. `renderAll()` atualizado

### Fluxo de Importação CSV
1. Selecionar arquivo → parseCSV (split por newline + detectar delimitador)
2. Cada linha convertida para objeto Task via csvRowToTask
3. Preview exibido com marcação de duplicatas
4. Confirmar → deduplicar por origemId → adicionar ao array → log registrado

### Regras de Negócio
- **Prioridade Alta** → cor vermelha; **Média** → amarela; **Baixa** → verde
- **Capacidade Dev**: > 90% = vermelho, > 70% = amarelo, ≤ 70% = verde
- **Releases**: mostradas apenas se tiverem ao menos 1 tarefa associada
- **Homepage**: exibe apenas tarefas do usuário logado (match por name/username/email)
- **Badge integrações**: conta tarefas com origem !== "manual"
- **Log**: mantém apenas as últimas 20 entradas

---

## 3. Bugs Encontrados

### Bug #1 — `getStats()` não retorna `devHours` nem `qaHours`
- **Arquivo:** `src/utils/helpers.js`, linha 191–216
- **Localização de uso:** `src/assets/js/devtrack-app.js`, linha 967–980 (renderHomepage)
- **Descrição:** `renderHomepage()` usa `stats.devHours` e `stats.qaHours` para exibir o resumo de horas, mas a função `getStats()` retorna apenas `totalHours` (soma de dev + qa) e `hoursCompleted`. As propriedades `devHours` e `qaHours` são `undefined`, fazendo o resumo de horas mostrar `undefinedh`.
- **Correção aplicada no projeto_web:** Adicionados `devHours` e `qaHours` ao retorno de `getStats()`.

---

## 4. Decisões de Arquitetura para o Novo Projeto

| Decisão | Escolha | Justificativa |
|---|---|---|
| Backend | Supabase (free tier) | Zero custo, PostgreSQL gerenciado, client JS nativo |
| Hosting | Vercel (free tier) | Deploy direto do GitHub, zero custo para sites estáticos |
| Auth | Tabela `users_devtrack` + validação manual | Mantém comportamento idêntico ao original |
| Fallback | Dados em memória (INITIAL_TASKS) | Funciona sem Supabase configurado |
| DataProvider | `SupabaseDataProvider extends DataProvider` | Preserva padrão de abstração do original |
| CSS/JS | Vanilla (sem frameworks) | Fidelidade total ao original |
| Dados estáticos | Tabelas `releases`, `users_devtrack` | Migrations via schema.sql |
| Persistência | Supabase Realtime off, REST API | Simplicidade e zero custo |
