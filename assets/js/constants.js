/**
 * CONSTANTES — DevTrack Sprint Manager
 * Todas as configurações centralizadas.
 * Altere aqui para customizar sem mexer na lógica da aplicação.
 */

const DEVTRACK_CONFIG = {

  // ── USUÁRIOS (fallback quando Supabase não está configurado) ──
  // role: "admin" | "developer" | "products"
  // menus: lista de views acessíveis (homepage e kanban são sempre obrigatórias)
  USERS: [
    { username: "Alexandre",    name: "Alexandre",    password: "abc123",    role: "admin",     active: true, menus: ["dashboard","backlog","release","integrations","developers","users"] },
    { username: "Bruno",        name: "Bruno",        password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "Lucas",        name: "Lucas",        password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "Leandro",      name: "Leandro",      password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "Marini",       name: "Marini",       password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "Michael",      name: "Michael",      password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "Pedro",        name: "Pedro",        password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "ElawOn",       name: "ElawOn",       password: "abc123",    role: "developer", active: true, menus: ["dashboard","backlog"] },
    { username: "leandro.lima", name: "Leandro Lima", password: "Lesao@123", role: "admin",     active: true, menus: ["dashboard","backlog","release","integrations","developers","users"] },
  ],

  // ── DESENVOLVEDORES — horas disponíveis por produto por dia útil ──
  DEVELOPERS: [
    { name: "Alexandre", Enterprise: 7, CLM: 0, ElawOn: 0, active: true },
    { name: "Bruno",     Enterprise: 6, CLM: 0, ElawOn: 0, active: true },
    { name: "Lucas",     Enterprise: 0, CLM: 0, ElawOn: 0, active: true },
    { name: "Leandro",   Enterprise: 5, CLM: 0, ElawOn: 0, active: true },
    { name: "Rodrigo",   Enterprise: 6, CLM: 0, ElawOn: 0, active: true },
    { name: "Marini",    Enterprise: 6, CLM: 0, ElawOn: 0, active: true },
    { name: "Michael",   Enterprise: 6, CLM: 0, ElawOn: 0, active: true },
    { name: "Pedro",     Enterprise: 2, CLM: 0, ElawOn: 0, active: true },
    { name: "ElawOn",    Enterprise: 0, CLM: 0, ElawOn: 0, active: true },
  ],

  // ── DADOS FIXOS (derivados de DEVELOPERS em runtime via _syncDevConfig) ──
  DEVS: [
    "Alexandre", "Bruno", "Lucas", "Leandro",
    "Rodrigo", "Marini", "Michael", "Pedro", "ElawOn",
  ],

  DEV_HORAS: {
    "Alexandre": 140,
    "Bruno": 120,
    "Lucas": 0,
    "Leandro": 100,
    "Rodrigo": 120,
    "Marini": 120,
    "Michael": 120,
    "Pedro": 40,
    "ElawOn": 0,
  },

  RELEASES: [
    { id: "7.10.0", produto: "Enterprise", dataInicio: "01/08/2025", dataFim: "30/11/2025", status: "Concluído"    },
    { id: "7.12.0", produto: "Enterprise", dataInicio: "01/12/2025", dataFim: "11/03/2026", status: "Em Andamento" },
    { id: "7.1.18", produto: "CLM",        dataInicio: "01/12/2025", dataFim: "11/03/2026", status: "Em Andamento" },
    { id: "7.14.0", produto: "Enterprise", dataInicio: "12/03/2026", dataFim: "30/04/2026", status: "Planejado"    },
    { id: "7.16.0", produto: "Enterprise", dataInicio: "01/05/2026", dataFim: "30/06/2026", status: "Planejado"    },
  ],

  STATUS_LIST: [
    "Pendente",
    "Planejado",
    "Em Desenvolvimento",
    "Em Homologação - QA",
    "Em Homologação - Cliente",
    "Concluído",
    "Bloqueado",
  ],

  TIPOS: ["NOVA FEATURE", "DÉBITO TÉCNICO", "VULNERABILIDADE", "CUSTOMIZAÇÃO"],

  CLASSIFICACOES: ["Evolução", "Customização"],

  PRIORIDADES: ["Alta", "Média", "Baixa"],

  MODULOS: [
    "Contencioso", "Societário", "Contratos",
    "Procurações", "Consultivo", "Imobiliário",
    "E-Billing", "Geral", "Adm",
  ],

  // ── ESTILOS (CORES) ──
  STATUS_STYLE: {
    "Pendente":                  { color: "#94a3b8", bg: "#0f172a",  dot: "#94a3b8" },
    "Planejado":                 { color: "#64748b", bg: "#1e293b",  dot: "#64748b" },
    "Em Desenvolvimento":        { color: "#0ea5e9", bg: "#0c1f33",  dot: "#0ea5e9" },
    "Em Homologação - QA":       { color: "#f59e0b", bg: "#1c1505",  dot: "#f59e0b" },
    "Em Homologação - Cliente":  { color: "#f97316", bg: "#1c0a00",  dot: "#f97316" },
    "Concluído":                 { color: "#10b981", bg: "#022c1e",  dot: "#10b981" },
    "Bloqueado":                 { color: "#ef4444", bg: "#1c0000",  dot: "#ef4444" },
  },

  PRIO_STYLE: {
    "Alta":  { color: "#ef4444", bg: "#1c0000" },
    "Média": { color: "#f59e0b", bg: "#1c1505" },
    "Baixa": { color: "#10b981", bg: "#022c1e" },
  },

  TIPO_STYLE: {
    "NOVA FEATURE":   { color: "#0ea5e9", icon: "⚡" },
    "DÉBITO TÉCNICO": { color: "#8b5cf6", icon: "🔧" },
    "VULNERABILIDADE":{ color: "#ef4444", icon: "🛡"  },
    "CUSTOMIZAÇÃO":   { color: "#f97316", icon: "✏️"  },
  },

  // ── DADOS DE EXEMPLO (usados se Supabase não tiver dados) ──
  INITIAL_TASKS: [
    { id: 90203,  ticketOrc: "84211",  horasDev: 80,  horasQa: 40, tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Contencioso", cliente: "ELAW INTERNO",       desc: "Nova Feature - Ajustes Indice Variation",                release: "7.12.0", prioridade: "Baixa", status: "Concluído",                dev: "Alexandre", demandante: "Vinicius Bavaroti", dataReg: "18/02/2025", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 100855, ticketOrc: "93046",  horasDev: 40,  horasQa: 32, tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Contencioso", cliente: "MOTO HONDA",          desc: "[Evolução] Restrições Divisão do Jurídico - Honda",       release: "7.10.0", prioridade: "Alta",  status: "Concluído",                dev: "Alexandre", demandante: "Otávio Assis",      dataReg: "17/04/2025", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 118282, ticketOrc: "100850", horasDev: 40,  horasQa: 32, tipo: "NOVA FEATURE",    classif: "Customização",modulo: "Contencioso", cliente: "PORTO SEGURO",        desc: "Implementar filtro de Sub-Ramo em fluxos",                release: "7.10.0", prioridade: "Alta",  status: "Concluído",                dev: "Alexandre", demandante: "Vanessa Oliveira",  dataReg: "28/07/2025", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 136529, ticketOrc: "N/A",   horasDev: 120, horasQa: 40, tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Societário",  cliente: "ANIMA HOLDING S.A.",  desc: "INTEGRAÇÃO DE ASSINATURA NO MODULO SOCIETÁRIO",          release: "7.12.0", prioridade: "Alta",  status: "Concluído",                dev: "Bruno",     demandante: "Otávio Assis",      dataReg: "01/11/2025", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 140548, ticketOrc: "N/A",   horasDev: 0,   horasQa: 0,  tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Geral",       cliente: "ELAW INTERNO",       desc: "Correção de performance - otimização de carregamento",    release: "7.1.18", prioridade: "Alta",  status: "Planejado",                dev: "Marini",    demandante: "Felipe Beltrão",    dataReg: "10/12/2025", origem: "manual", origemId: "", produto: "CLM" },
    { id: 144534, ticketOrc: "N/A",   horasDev: 4,   horasQa: 4,  tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Geral",       cliente: "PEPSICO",             desc: "Inclusão do status da filial no dicionário",              release: "7.14.0", prioridade: "Baixa", status: "Planejado",                dev: "Alexandre", demandante: "Vanessa Oliveira",  dataReg: "13/01/2026", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 146619, ticketOrc: "N/A",   horasDev: 5,   horasQa: 8,  tipo: "NOVA FEATURE",    classif: "Evolução",    modulo: "Contencioso", cliente: "PORTO SEGURO",        desc: "Bloqueio para datas retroativas em prazo avulso",         release: "7.14.0", prioridade: "Baixa", status: "Em Desenvolvimento",       dev: "Alexandre", demandante: "Otávio Assis",      dataReg: "22/01/2026", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 147200, ticketOrc: "N/A",   horasDev: 24,  horasQa: 16, tipo: "DÉBITO TÉCNICO",  classif: "Evolução",    modulo: "Societário",  cliente: "ANIMA HOLDING S.A.",  desc: "Ajuste de performance na tela de atos societários",       release: "7.14.0", prioridade: "Alta",  status: "Em Homologação - QA",      dev: "Lucas",     demandante: "Lucas Frias",       dataReg: "10/02/2026", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 148005, ticketOrc: "N/A",   horasDev: 16,  horasQa: 8,  tipo: "VULNERABILIDADE", classif: "Evolução",    modulo: "Geral",       cliente: "ELAW INTERNO",       desc: "Correção de XSS em campos de texto livre",                release: "7.14.0", prioridade: "Alta",  status: "Em Homologação - Cliente", dev: "Leandro",   demandante: "Felipe Beltrão",    dataReg: "15/02/2026", origem: "manual", origemId: "", produto: "Enterprise" },
    { id: 148912, ticketOrc: "N/A",   horasDev: 32,  horasQa: 16, tipo: "NOVA FEATURE",    classif: "Customização",modulo: "E-Billing",   cliente: "SCANIA LATIN AMERICA", desc: "Configuração de regras de faturamento por área",          release: "7.16.0", prioridade: "Alta",  status: "Planejado",                dev: "Michael",   demandante: "Vanessa Oliveira",  dataReg: "01/03/2026", origem: "manual", origemId: "", produto: "Enterprise" },
  ],
};
