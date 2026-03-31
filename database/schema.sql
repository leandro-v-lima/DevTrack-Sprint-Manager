-- ═══════════════════════════════════════════════════════════════════════════
-- DevTrack Sprint Manager — Schema PostgreSQL (Supabase)
-- Execute este script no SQL Editor do Supabase após criar o projeto.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: tasks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id           BIGINT PRIMARY KEY,
  ticket_orc   TEXT    DEFAULT 'N/A',
  horas_dev    INTEGER DEFAULT 0,
  horas_qa     INTEGER DEFAULT 0,
  tipo         TEXT    NOT NULL DEFAULT 'NOVA FEATURE',
  classif      TEXT    DEFAULT 'Evolução',
  modulo       TEXT    DEFAULT 'Geral',
  cliente      TEXT    DEFAULT '',
  descricao    TEXT    DEFAULT '',
  release      TEXT    DEFAULT '',
  prioridade   TEXT    DEFAULT 'Média',
  status       TEXT    DEFAULT 'Pendente',
  dev          TEXT    DEFAULT '',
  demandante   TEXT    DEFAULT '',
  data_reg     TEXT    DEFAULT '',
  origem       TEXT    DEFAULT 'manual',
  origem_id    TEXT    DEFAULT '',
  produto      TEXT    DEFAULT 'Enterprise',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Migração segura: adiciona coluna produto se não existir
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS produto TEXT DEFAULT 'Enterprise';

CREATE INDEX IF NOT EXISTS idx_tasks_status    ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_dev       ON public.tasks (dev);
CREATE INDEX IF NOT EXISTS idx_tasks_release   ON public.tasks (release);
CREATE INDEX IF NOT EXISTS idx_tasks_origem    ON public.tasks (origem);
CREATE INDEX IF NOT EXISTS idx_tasks_origem_id ON public.tasks (origem_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated   ON public.tasks (updated_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: users_devtrack
-- role: admin | developer | products
-- menus: JSONB array com os views liberados para o perfil (ex: ["dashboard","backlog"])
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users_devtrack (
  id               SERIAL PRIMARY KEY,
  username         TEXT    UNIQUE NOT NULL,
  name             TEXT    NOT NULL,
  password         TEXT    NOT NULL,
  role             TEXT    DEFAULT 'developer',   -- admin | developer | products
  menus            JSONB   DEFAULT '[]'::jsonb,   -- menus visíveis para o usuário
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona colunas novas se a tabela já existe (migrações seguras)
ALTER TABLE public.users_devtrack
  ADD COLUMN IF NOT EXISTS role  TEXT    DEFAULT 'developer',
  ADD COLUMN IF NOT EXISTS menus JSONB   DEFAULT '[]'::jsonb;

-- Remove coluna legada horas_disponivel se existir (não é mais usada)
-- Descomente apenas se quiser remover a coluna antiga:
-- ALTER TABLE public.users_devtrack DROP COLUMN IF EXISTS horas_disponivel;

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users_devtrack (username);
CREATE INDEX IF NOT EXISTS idx_users_name     ON public.users_devtrack (name);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: developers
-- Horas disponíveis por produto por dia útil.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.developers (
  id          SERIAL PRIMARY KEY,
  name        TEXT    UNIQUE NOT NULL,          -- Nome do desenvolvedor
  enterprise  NUMERIC(4,1) DEFAULT 0,           -- Horas/dia para produto Enterprise
  clm         NUMERIC(4,1) DEFAULT 0,           -- Horas/dia para produto CLM
  elawon      NUMERIC(4,1) DEFAULT 0,           -- Horas/dia para produto ElawOn
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_developers_name ON public.developers (name);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: releases
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.releases (
  id          TEXT PRIMARY KEY,
  produto     TEXT NOT NULL,
  data_inicio TEXT DEFAULT '',
  data_fim    TEXT NOT NULL,
  status      TEXT DEFAULT 'Planejado',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: time_entries
-- Apontamento de horas utilizadas por task.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_entries (
  id         SERIAL PRIMARY KEY,
  task_id    BIGINT NOT NULL,
  dev        TEXT DEFAULT '',
  data       TEXT DEFAULT '',   -- dd/mm/yyyy
  horas      NUMERIC(5,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_te_task_id  ON public.time_entries (task_id);
CREATE INDEX IF NOT EXISTS idx_te_data     ON public.time_entries (data);

DROP POLICY IF EXISTS "allow_all_time_entries" ON public.time_entries;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_time_entries"
  ON public.time_entries FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: import_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_logs (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT    NOT NULL,
  total       INTEGER DEFAULT 0,
  adicionados INTEGER DEFAULT 0,
  duplicatas  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_created ON public.import_logs (created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_devtrack ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_tasks"       ON public.tasks;
DROP POLICY IF EXISTS "allow_all_users"       ON public.users_devtrack;
DROP POLICY IF EXISTS "allow_all_releases"    ON public.releases;
DROP POLICY IF EXISTS "allow_all_developers"  ON public.developers;
DROP POLICY IF EXISTS "allow_all_logs"        ON public.import_logs;

CREATE POLICY "allow_all_tasks"
  ON public.tasks FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_users"
  ON public.users_devtrack FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_releases"
  ON public.releases FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_developers"
  ON public.developers FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_logs"
  ON public.import_logs FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Usuários (role: admin | developer | products)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.users_devtrack (username, name, password, role, menus, active) VALUES
  ('Alexandre',    'Alexandre',    'abc123',    'admin',     '["dashboard","backlog","release","integrations","developers","users"]'::jsonb, true),
  ('Bruno',        'Bruno',        'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('Lucas',        'Lucas',        'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('Leandro',      'Leandro',      'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('Marini',       'Marini',       'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('Michael',      'Michael',      'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('Pedro',        'Pedro',        'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('ElawOn',       'ElawOn',       'abc123',    'developer', '["dashboard","backlog"]'::jsonb, true),
  ('leandro.lima', 'Leandro Lima', 'Lesao@123', 'admin',     '["dashboard","backlog","release","integrations","developers","users"]'::jsonb, true)
ON CONFLICT (username) DO UPDATE SET
  role   = EXCLUDED.role,
  menus  = EXCLUDED.menus,
  active = EXCLUDED.active;


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Desenvolvedores
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.developers (name, enterprise, clm, elawon, active) VALUES
  ('Alexandre', 7,   0, 0, true),
  ('Bruno',     6,   0, 0, true),
  ('Lucas',     0,   0, 0, true),
  ('Leandro',   5,   0, 0, true),
  ('Rodrigo',   6,   0, 0, true),
  ('Marini',    6,   0, 0, true),
  ('Michael',   6,   0, 0, true),
  ('Pedro',     2,   0, 0, true),
  ('ElawOn',    0,   0, 0, true)
ON CONFLICT (name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Releases
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.releases (id, produto, data_inicio, data_fim, status) VALUES
  ('7.10.0', 'Enterprise', '01/08/2025', '30/11/2025', 'Concluído'),
  ('7.12.0', 'Enterprise', '01/12/2025', '11/03/2026', 'Em Andamento'),
  ('7.1.18',  'CLM',        '01/12/2025', '11/03/2026', 'Em Andamento'),
  ('7.14.0', 'Enterprise', '12/03/2026', '30/04/2026', 'Planejado'),
  ('7.16.0', 'Enterprise', '01/05/2026', '30/06/2026', 'Planejado')
ON CONFLICT (id) DO UPDATE SET
  data_inicio = EXCLUDED.data_inicio,
  data_fim    = EXCLUDED.data_fim,
  status      = EXCLUDED.status;


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Tarefas
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tasks
  (id, ticket_orc, horas_dev, horas_qa, tipo, classif, modulo, cliente, descricao, release, prioridade, status, dev, demandante, data_reg, origem, origem_id, produto)
VALUES
  (90203,  '84211',  80,  40, 'NOVA FEATURE',    'Evolução',    'Contencioso', 'ELAW INTERNO',        'Nova Feature - Ajustes Indice Variation',              '7.12.0', 'Baixa', 'Concluído',                'Alexandre', 'Vinicius Bavaroti', '18/02/2025', 'manual', '', 'Enterprise'),
  (100855, '93046',  40,  32, 'NOVA FEATURE',    'Evolução',    'Contencioso', 'MOTO HONDA',          '[Evolução] Restrições Divisão do Jurídico - Honda',    '7.10.0', 'Alta',  'Concluído',                'Alexandre', 'Otávio Assis',      '17/04/2025', 'manual', '', 'Enterprise'),
  (118282, '100850', 40,  32, 'NOVA FEATURE',    'Customização','Contencioso', 'PORTO SEGURO',        'Implementar filtro de Sub-Ramo em fluxos',             '7.10.0', 'Alta',  'Concluído',                'Alexandre', 'Vanessa Oliveira',  '28/07/2025', 'manual', '', 'Enterprise'),
  (136529, 'N/A',   120,  40, 'NOVA FEATURE',    'Evolução',    'Societário',  'ANIMA HOLDING S.A.',  'INTEGRAÇÃO DE ASSINATURA NO MODULO SOCIETÁRIO',       '7.12.0', 'Alta',  'Concluído',                'Bruno',     'Otávio Assis',      '01/11/2025', 'manual', '', 'Enterprise'),
  (140548, 'N/A',    0,    0, 'NOVA FEATURE',    'Evolução',    'Geral',       'ELAW INTERNO',        'Correção de performance - otimização de carregamento', '7.1.18', 'Alta',  'Planejado',                'Marini',    'Felipe Beltrão',    '10/12/2025', 'manual', '', 'CLM'),
  (144534, 'N/A',    4,    4, 'NOVA FEATURE',    'Evolução',    'Geral',       'PEPSICO',             'Inclusão do status da filial no dicionário',           '7.14.0', 'Baixa', 'Planejado',                'Alexandre', 'Vanessa Oliveira',  '13/01/2026', 'manual', '', 'Enterprise'),
  (146619, 'N/A',    5,    8, 'NOVA FEATURE',    'Evolução',    'Contencioso', 'PORTO SEGURO',        'Bloqueio para datas retroativas em prazo avulso',      '7.14.0', 'Baixa', 'Em Desenvolvimento',       'Alexandre', 'Otávio Assis',      '22/01/2026', 'manual', '', 'Enterprise'),
  (147200, 'N/A',   24,   16, 'DÉBITO TÉCNICO',  'Evolução',    'Societário',  'ANIMA HOLDING S.A.',  'Ajuste de performance na tela de atos societários',    '7.14.0', 'Alta',  'Em Homologação - QA',      'Lucas',     'Lucas Frias',       '10/02/2026', 'manual', '', 'Enterprise'),
  (148005, 'N/A',   16,    8, 'VULNERABILIDADE', 'Evolução',    'Geral',       'ELAW INTERNO',        'Correção de XSS em campos de texto livre',             '7.14.0', 'Alta',  'Em Homologação - Cliente', 'Leandro',   'Felipe Beltrão',    '15/02/2026', 'manual', '', 'Enterprise'),
  (148912, 'N/A',   32,   16, 'NOVA FEATURE',    'Customização','E-Billing',   'SCANIA LATIN AMERICA','Configuração de regras de faturamento por área',       '7.16.0', 'Alta',  'Planejado',                'Michael',   'Vanessa Oliveira',  '01/03/2026', 'manual', '', 'Enterprise')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER: atualiza updated_at automaticamente nas tasks
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
