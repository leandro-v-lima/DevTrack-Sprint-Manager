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
