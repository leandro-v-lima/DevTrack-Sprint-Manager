/**
 * Funções Auxiliares — DevTrack Sprint Manager
 * Utilitários puros (sem efeitos colaterais) para uso em toda a aplicação.
 *
 * BUGFIX aplicado:
 *   - getStats() agora retorna devHours e qaHours separadamente,
 *     corrigindo o bug onde renderHomepage() exibia "undefinedh" no resumo de horas.
 */

/**
 * Gera HTML de avatar circular com iniciais e cor derivada do nome
 */
function avatarHTML(name, size = 20) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:hsl(${hue},55%,32%);border:2px solid hsl(${hue},55%,20%);font-size:${size * 0.36}px" title="${name}">${initials}</div>`;
}

/**
 * Cria badge HTML com cor e fundo customizados
 */
function badge(label, color, bg) {
  return `<span class="badge" style="background:${bg};color:${color};border:1px solid ${color}30">${label}</span>`;
}

/**
 * Define programaticamente o valor de um elemento <select>
 */
function setSelect(id, val) {
  const s = document.getElementById(id);
  if (!s) return;
  for (const o of s.options) {
    if (o.value === val) { s.value = val; break; }
  }
}

/**
 * Exibe ou oculta um elemento de alerta pelo ID
 * @param {string} id - ID do elemento de alerta
 * @param {string} msg - Mensagem (vazio para ocultar)
 * @param {string} type - "error" | "success" | "info"
 */
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) { el.style.display = "none"; return; }
  el.className = "alert alert-" + type;
  el.textContent = msg;
  el.style.display = "";
}

/**
 * Pausa assíncrona (Promise-based delay)
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Formata número com zero à esquerda
 */
function padZero(num, size = 2) {
  return String(num).padStart(size, "0");
}

/**
 * Formata data para dd/mm/yyyy (pt-BR)
 */
function formatDate(date) {
  if (typeof date === "string") return date;
  if (!(date instanceof Date)) date = new Date(date);
  return (
    padZero(date.getDate()) + "/" +
    padZero(date.getMonth() + 1) + "/" +
    date.getFullYear()
  );
}

/**
 * Formata hora para HH:mm:ss
 */
function formatTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return (
    padZero(date.getHours()) + ":" +
    padZero(date.getMinutes()) + ":" +
    padZero(date.getSeconds())
  );
}

/**
 * Calcula capacidade e utilização de um desenvolvedor
 * @returns {{ totalHours, capacity, percentage, color }}
 */
function calcDevCapacity(devName, tasks, devHours) {
  const totalHours = tasks
    .filter((t) => t.dev === devName)
    .reduce((a, t) => a + t.horasDev, 0);
  const capacity = devHours[devName] || 1;
  const percentage = Math.min(100, Math.round((totalHours / capacity) * 100));
  const color =
    percentage > 90 ? "var(--red)" :
    percentage > 70 ? "var(--yellow)" :
    "var(--green)";
  return { totalHours, capacity, percentage, color };
}

/**
 * Copia texto para o clipboard com fallback para navegadores antigos
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

/**
 * Valida formato de e-mail
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Retorna a cor associada a um status
 */
function getColorByStatus(status) {
  const style = DEVTRACK_CONFIG?.STATUS_STYLE?.[status];
  return style ? style.color : "var(--muted)";
}

/**
 * Retorna a cor associada a um tipo de tarefa
 */
function getColorByType(tipo) {
  const style = DEVTRACK_CONFIG?.TIPO_STYLE?.[tipo];
  return style ? style.color : "var(--text)";
}

/**
 * Ordena array por propriedade (retorna novo array, não modifica o original)
 */
function sortBy(arr, prop, desc = false) {
  return [...arr].sort((a, b) => {
    const va = a[prop];
    const vb = b[prop];
    if (typeof va === "string") return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    return desc ? vb - va : va - vb;
  });
}

/**
 * Remove duplicatas de um array por uma propriedade chave
 */
function uniqueBy(arr, prop) {
  return [...new Map(arr.map((item) => [item[prop], item])).values()];
}

/**
 * Agrupa array em objeto por uma propriedade (group by)
 */
function groupBy(arr, prop) {
  return arr.reduce((groups, item) => {
    const key = item[prop];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Calcula estatísticas gerais das tarefas.
 *
 * BUGFIX: adicionados devHours e qaHours ao retorno.
 * O original não retornava essas propriedades, causando "undefinedh"
 * no resumo de horas da Homepage.
 *
 * @param {Array} tasks - Lista de tarefas
 * @returns {{ total, completed, completionRate, inProgress, blocked,
 *             totalHours, hoursCompleted, devHours, qaHours }}
 */
function getStats(tasks) {
  const total      = tasks.length;
  const completed  = tasks.filter((t) => t.status === "Concluído").length;
  const inProgress = tasks.filter((t) =>
    ["Em Desenvolvimento", "Em Homologação - QA", "Em Homologação - Cliente"].includes(t.status)
  ).length;
  const blocked         = tasks.filter((t) => t.status === "Bloqueado").length;
  const devHours        = tasks.reduce((a, t) => a + (t.horasDev || 0), 0);
  const qaHours         = tasks.reduce((a, t) => a + (t.horasQa  || 0), 0);
  const totalHours      = devHours + qaHours;
  const hoursCompleted  = tasks
    .filter((t) => t.status === "Concluído")
    .reduce((a, t) => a + (t.horasDev || 0) + (t.horasQa || 0), 0);

  return {
    total,
    completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    inProgress,
    blocked,
    devHours,       // ← BUGFIX: adicionado
    qaHours,        // ← BUGFIX: adicionado
    totalHours,
    hoursCompleted,
  };
}

/**
 * Algoritmo de Butcher para calcular a data da Páscoa
 */
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Retorna um Set com os feriados nacionais brasileiros de um ano (formato "yyyy-mm-dd")
 */
function getHolidaysBR(year) {
  const holidays = new Set();
  const add = (m, d) => {
    const dt = new Date(year, m - 1, d);
    holidays.add(dt.toISOString().slice(0, 10));
  };
  // Feriados fixos
  add(1, 1); add(4, 21); add(5, 1); add(9, 7);
  add(10, 12); add(11, 2); add(11, 15); add(11, 20); add(12, 25);
  // Feriados móveis (baseados na Páscoa)
  const easter  = getEaster(year);
  const addDays = (dt, n) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
  [
    addDays(easter, -48), // Carnaval (segunda)
    addDays(easter, -47), // Carnaval (terça)
    addDays(easter, -2),  // Sexta-feira Santa
    addDays(easter, 60),  // Corpus Christi
  ].forEach(dt => holidays.add(dt.toISOString().slice(0, 10)));
  return holidays;
}

/**
 * Conta dias úteis entre duas datas (aceita "dd/mm/yyyy" ou "yyyy-mm-dd")
 */
function businessDays(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const parseDate = (s) => {
    if (s.includes("/")) { const [d, m, y] = s.split("/").map(Number); return new Date(y, m - 1, d); }
    const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d);
  };
  const start = parseDate(startStr), end = parseDate(endStr);
  if (isNaN(start) || isNaN(end) || start > end) return 0;
  const holidays = new Set();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++)
    getHolidaysBR(y).forEach(h => holidays.add(h));
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(cur.toISOString().slice(0, 10))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Converte "dd/mm/yyyy" → "yyyy-mm-dd" (formato para input[type=date]) */
function displayToDateInput(s) {
  if (!s || !s.includes("/")) return s || "";
  const [d, m, y] = s.split("/");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

/** Converte "yyyy-mm-dd" → "dd/mm/yyyy" */
function dateInputToDisplay(s) {
  if (!s || !s.includes("-")) return s || "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
