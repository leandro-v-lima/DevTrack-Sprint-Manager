-- ═══════════════════════════════════════════════════════════════════════════
-- DevTrack Sprint Manager — Schema PostgreSQL (Supabase)
-- Execute este script no SQL Editor do Supabase após criar o projeto.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: tasks
-- Armazena todas as tarefas/tickets do backlog de desenvolvimento.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id           BIGINT PRIMARY KEY,          -- ID único da tarefa (ex: 90203)
  ticket_orc   TEXT    DEFAULT 'N/A',       -- Número do ticket de orçamento
  horas_dev    INTEGER DEFAULT 0,           -- Horas estimadas de desenvolvimento
  horas_qa     INTEGER DEFAULT 0,           -- Horas estimadas de QA
  tipo         TEXT    NOT NULL DEFAULT 'NOVA FEATURE', -- NOVA FEATURE | DÉBITO TÉCNICO | VULNERABILIDADE | CUSTOMIZAÇÃO
  classif      TEXT    DEFAULT 'Evolução',  -- Evolução | Customização
  modulo       TEXT    DEFAULT 'Geral',     -- Módulo do sistema afetado
  cliente      TEXT    DEFAULT '',          -- Nome do cliente
  descricao    TEXT    DEFAULT '',          -- Descrição da tarefa
  release      TEXT    DEFAULT '',          -- Versão da release (ex: 7.14.0)
  prioridade   TEXT    DEFAULT 'Média',     -- Alta | Média | Baixa
  status       TEXT    DEFAULT 'Planejado', -- Ver STATUS_LIST em constants.js
  dev          TEXT    DEFAULT '',          -- Nome do desenvolvedor responsável
  demandante   TEXT    DEFAULT '',          -- Nome de quem demandou
  data_reg     TEXT    DEFAULT '',          -- Data de registro (dd/mm/yyyy)
  origem       TEXT    DEFAULT 'manual',    -- manual | csv | api
  origem_id    TEXT    DEFAULT '',          -- ID original no sistema de origem (para dedup)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.tasks IS 'Tarefas e tickets do backlog de desenvolvimento';
COMMENT ON COLUMN public.tasks.origem IS 'Origem da tarefa: manual (criada no app), csv (importada), api (sincronizada)';
COMMENT ON COLUMN public.tasks.origem_id IS 'ID no sistema externo, usado para evitar duplicatas na importação';

-- Índices para performance nas consultas mais comuns
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_dev       ON public.tasks (dev);
CREATE INDEX IF NOT EXISTS idx_tasks_release   ON public.tasks (release);
CREATE INDEX IF NOT EXISTS idx_tasks_origem    ON public.tasks (origem);
CREATE INDEX IF NOT EXISTS idx_tasks_origem_id ON public.tasks (origem_id);
CREATE INDEX IF NOT EXISTS idx_tasks_updated   ON public.tasks (updated_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: users_devtrack
-- Usuários do sistema (separado do Supabase Auth para manter comportamento original).
-- ATENÇÃO: Em produção real, hashing de senha deve ser implementado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users_devtrack (
  id               SERIAL PRIMARY KEY,
  username         TEXT    UNIQUE NOT NULL,   -- Login do usuário
  name             TEXT    NOT NULL,          -- Nome de exibição
  password         TEXT    NOT NULL,          -- Senha (plaintext para manter compatibilidade - ver nota acima)
  horas_disponivel INTEGER DEFAULT 40,        -- Horas disponíveis por mês
  role             TEXT    DEFAULT 'user',    -- user | admin
  active           BOOLEAN DEFAULT TRUE,      -- Usuário ativo/inativo
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.users_devtrack IS 'Usuários do DevTrack (sistema próprio, não usa Supabase Auth)';
COMMENT ON COLUMN public.users_devtrack.role IS 'Função: user = desenvolvedor padrão, admin = acesso total';

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users_devtrack (username);
CREATE INDEX IF NOT EXISTS idx_users_name     ON public.users_devtrack (name);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: releases
-- Versões de produto planejadas ou em andamento.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.releases (
  id          TEXT PRIMARY KEY,              -- Versão (ex: 7.14.0)
  produto     TEXT NOT NULL,                 -- Enterprise | CLM | ElawOn
  data_inicio TEXT DEFAULT '',              -- Data de início (dd/mm/yyyy)
  data_fim    TEXT NOT NULL,                 -- Data de entrega prevista (dd/mm/yyyy)
  status      TEXT DEFAULT 'Planejado',      -- Planejado | Em Andamento | Concluído
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.releases IS 'Versões de produto — associadas às tarefas pelo campo release (id)';


-- ─────────────────────────────────────────────────────────────────────────────
-- TABELA: import_logs
-- Histórico das importações CSV e sincronizações API.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_logs (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT    NOT NULL,              -- csv | api
  total       INTEGER DEFAULT 0,            -- Total de tickets processados
  adicionados INTEGER DEFAULT 0,            -- Quantos foram adicionados
  duplicatas  INTEGER DEFAULT 0,            -- Quantos foram ignorados por já existir
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.import_logs IS 'Histórico de importações CSV e sincronizações via API';

CREATE INDEX IF NOT EXISTS idx_import_logs_created ON public.import_logs (created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Para uso como ferramenta interna sem Supabase Auth, usamos políticas
-- permissivas com a anon key. Ajuste conforme a necessidade de segurança.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_devtrack ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs    ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para a chave anon (ferramenta interna)
-- Se quiser restringir o acesso, substitua "true" por verificações de auth.uid()

CREATE POLICY "allow_all_tasks"
  ON public.tasks FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_users"
  ON public.users_devtrack FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_releases"
  ON public.releases FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_logs"
  ON public.import_logs FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Usuários
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.users_devtrack (username, name, password, horas_disponivel, role, active) VALUES
  ('Alexandre',    'Alexandre',    'abc123',    140, 'admin', true),
  ('Bruno',        'Bruno',        'abc123',    120, 'user',  true),
  ('Lucas',        'Lucas',        'abc123',      0, 'user',  true),
  ('Leandro',      'Leandro',      'abc123',    100, 'user',  true),
  ('Marini',       'Marini',       'abc123',    120, 'user',  true),
  ('Michael',      'Michael',      'abc123',    120, 'user',  true),
  ('Pedro',        'Pedro',        'abc123',     40, 'user',  true),
  ('ElawOn',       'ElawOn',       'abc123',      0, 'user',  true),
  ('leandro.lima', 'Leandro Lima', 'Lesao@123', 200, 'user',  true)
ON CONFLICT (username) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Releases
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.releases (id, produto, data_inicio, data_fim, status) VALUES
  ('7.10.0', 'Enterprise', '',           '30/11/2025', 'Concluído'),
  ('7.12.0', 'Enterprise', '',           '11/03/2026', 'Em Andamento'),
  ('7.1.18',  'CLM',        '',           '11/03/2026', 'Em Andamento'),
  ('7.14.0', 'Enterprise', '',           '30/04/2026', 'Planejado'),
  ('7.16.0', 'Enterprise', '',           '30/06/2026', 'Planejado')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- DADOS DE EXEMPLO — Tarefas
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tasks
  (id, ticket_orc, horas_dev, horas_qa, tipo, classif, modulo, cliente, descricao, release, prioridade, status, dev, demandante, data_reg, origem, origem_id)
VALUES
  (90203,  '84211',  80,  40, 'NOVA FEATURE',   'Evolução',    'Contencioso', 'ELAW INTERNO',       'Nova Feature - Ajustes Indice Variation',                 '7.12.0', 'Baixa', 'Concluído',                 'Alexandre', 'Vinicius Bavaroti', '18/02/2025', 'manual', ''),
  (100855, '93046',  40,  32, 'NOVA FEATURE',   'Evolução',    'Contencioso', 'MOTO HONDA',         '[Evolução] Restrições Divisão do Jurídico - Honda',       '7.10.0', 'Alta',  'Concluído',                 'Alexandre', 'Otávio Assis',      '17/04/2025', 'manual', ''),
  (118282, '100850', 40,  32, 'NOVA FEATURE',   'Customização','Contencioso', 'PORTO SEGURO',       'Implementar filtro de Sub-Ramo em fluxos',                '7.10.0', 'Alta',  'Concluído',                 'Alexandre', 'Vanessa Oliveira',  '28/07/2025', 'manual', ''),
  (136529, 'N/A',   120,  40, 'NOVA FEATURE',   'Evolução',    'Societário',  'ANIMA HOLDING S.A.', 'INTEGRAÇÃO DE ASSINATURA NO MODULO SOCIETÁRIO',          '7.12.0', 'Alta',  'Concluído',                 'Bruno',     'Otávio Assis',      '01/11/2025', 'manual', ''),
  (140548, 'N/A',    0,    0, 'NOVA FEATURE',   'Evolução',    'Geral',       'ELAW INTERNO',       'Correção de performance - otimização de carregamento',    '7.1.18', 'Alta',  'Planejado',                 'Marini',    'Felipe Beltrão',    '10/12/2025', 'manual', ''),
  (144534, 'N/A',    4,    4, 'NOVA FEATURE',   'Evolução',    'Geral',       'PEPSICO',            'Inclusão do status da filial no dicionário',              '7.14.0', 'Baixa', 'Planejado',                 'Alexandre', 'Vanessa Oliveira',  '13/01/2026', 'manual', ''),
  (146619, 'N/A',    5,    8, 'NOVA FEATURE',   'Evolução',    'Contencioso', 'PORTO SEGURO',       'Bloqueio para datas retroativas em prazo avulso',         '7.14.0', 'Baixa', 'Em Desenvolvimento',        'Alexandre', 'Otávio Assis',      '22/01/2026', 'manual', ''),
  (147200, 'N/A',   24,   16, 'DÉBITO TÉCNICO', 'Evolução',    'Societário',  'ANIMA HOLDING S.A.', 'Ajuste de performance na tela de atos societários',       '7.14.0', 'Alta',  'Em Homologação - QA',       'Lucas',     'Lucas Frias',       '10/02/2026', 'manual', ''),
  (148005, 'N/A',   16,    8, 'VULNERABILIDADE','Evolução',    'Geral',       'ELAW INTERNO',       'Correção de XSS em campos de texto livre',                '7.14.0', 'Alta',  'Em Homologação - Cliente',  'Leandro',   'Felipe Beltrão',    '15/02/2026', 'manual', ''),
  (148912, 'N/A',   32,   16, 'NOVA FEATURE',   'Customização','E-Billing',   'SCANIA LATIN AMERICA','Configuração de regras de faturamento por área',          '7.16.0', 'Alta',  'Planejado',                 'Michael',   'Vanessa Oliveira',  '01/03/2026', 'manual', '')
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
