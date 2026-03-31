/**
 * Componentes de Renderização — DevTrack Sprint Manager
 * Classe estática com funções puras de renderização para cada view.
 * Não mantém estado — recebe dados e injeta HTML no DOM.
 */

class UIComponents {

  /**
   * Renderiza o board Kanban com 6 colunas (uma por status)
   * Suporta drag & drop entre colunas para alterar o status da tarefa.
   */
  static renderKanban(tasks, config) {
    const board = document.getElementById("kanban-board");
    if (!board) return;
    board.innerHTML = "";

    config.STATUS_LIST.forEach((col) => {
      // "Pendente" tickets are not shown in Kanban (they live in Backlog only)
      if (col === "Pendente") return;
      const colTasks = tasks.filter((t) => t.status === col);
      const ss = config.STATUS_STYLE[col];

      const colEl = document.createElement("div");
      colEl.className = "kanban-col";
      colEl.innerHTML = `
        <div class="col-header">
          <div class="col-header-left">
            <div class="col-dot" style="background:${ss.dot}"></div>
            <span class="col-title">${col}</span>
          </div>
          <span class="col-count" style="background:${ss.bg};color:${ss.color}">${colTasks.length}</span>
        </div>
        <div class="col-body" id="col-${col.replace(/\s+/g, "_")}"></div>`;
      board.appendChild(colEl);

      const body = colEl.querySelector(".col-body");

      // Drag & drop: receber card
      body.addEventListener("dragover", (e) => {
        e.preventDefault();
        body.classList.add("drag-over");
      });
      body.addEventListener("dragleave", () => {
        body.classList.remove("drag-over");
      });
      body.addEventListener("drop", async (e) => {
        e.preventDefault();
        body.classList.remove("drag-over");
        const taskId = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(taskId)) return;
        const app = window.app;
        if (!app) return;
        const task = app.tasks.find((x) => x.id === taskId);
        if (!task || task.status === col) return;
        task.status = col;
        try {
          await app.dataProvider.saveTask(task);
        } catch (_) {
          // continua mesmo se save falhar (modo offline/fallback)
        }
        app.renderAll();
      });

      if (!colTasks.length) {
        body.innerHTML = '<p style="color:var(--dim);font-size:12px;text-align:center;padding:20px 0">Nenhuma tarefa</p>';
        return;
      }

      colTasks.forEach((t) => {
        const ps = config.PRIO_STYLE[t.prioridade] || config.PRIO_STYLE["Baixa"];
        const ts = config.TIPO_STYLE[t.tipo] || { icon: "?", color: "#fff" };
        const origemTag = t.origem !== "manual"
          ? `<span style="font-size:9px;font-weight:700;color:${t.origem === "csv" ? "#f59e0b" : "#10b981"};margin-right:4px">${t.origem.toUpperCase()}</span>`
          : "";

        const card = document.createElement("div");
        card.className = "kanban-card";
        card.setAttribute("draggable", "true");
        card.dataset.taskId = t.id;

        card.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", t.id);
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", () => card.classList.remove("dragging"));
        card.addEventListener("click", () => window.openModal(t));

        const releaseTag = t.release
          ? `<span style="font-size:9px;font-weight:700;color:var(--accent);font-family:monospace">${t.release}</span>`
          : "";
        const produtoColor = t.produto === "CLM" ? "#f59e0b" : t.produto === "ElawOn" ? "#a78bfa" : "#0ea5e9";
        const produtoTag = t.produto
          ? `<span style="font-size:9px;font-weight:700;color:${produtoColor};background:${produtoColor}15;padding:1px 5px;border-radius:4px;border:1px solid ${produtoColor}30">${t.produto}</span>`
          : "";

        card.innerHTML = `
          <div class="card-top">
            <span class="card-id">#${t.id}</span>
            <span>${origemTag}<span style="font-size:13px">${ts.icon}</span></span>
          </div>
          <p class="card-desc">${t.desc}</p>
          <p class="card-client">${t.cliente}</p>
          <div class="card-footer">
            <span class="badge" style="background:${ps.bg};color:${ps.color};border:1px solid ${ps.color}30;font-size:10px">${t.prioridade}</span>
            ${produtoTag}
            ${releaseTag}
            ${avatarHTML(t.dev, 22)}
          </div>`;

        body.appendChild(card);
      });
    });
  }

  /**
   * Renderiza a tabela de backlog com ordenação por coluna
   */
  static renderBacklog(tasks, config, sortCol, sortDir, expanded = new Set(), onToggle = () => {}, userRole = "admin") {
    const tbody = document.getElementById("backlog-body");
    if (!tbody) return;

    // Atualiza indicadores de ordenação nos headers
    document.querySelectorAll("#backlog-table th[data-col]").forEach((th) => {
      th.classList.toggle("sort-active", th.dataset.col === sortCol);
      th.textContent = th.textContent.replace(/ [↑↓]/, "");
      if (th.dataset.col === sortCol)
        th.textContent += sortDir === 1 ? " ↑" : " ↓";
    });

    const releaseOrder = config.RELEASES.map((r) => r.id);
    const releaseMap   = new Map(config.RELEASES.map((r) => [r.id, r]));

    // Agrupa tasks:
    //  __pendente__ = tickets com status "Pendente" (Pendente de Avaliação - vermelho)
    //  __none__     = tickets sem release e status != "Pendente" (Pendente de Planejamento - laranja)
    //  [release id] = agrupados pela release
    const groups = {};
    tasks.forEach((t) => {
      let key;
      if (t.status === "Pendente") {
        key = "__pendente__";
      } else {
        key = (t.release || "").trim() || "__none__";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    // Ordem: sem release → Em Andamento → Planejado → Concluído → desconhecidas
    const STATUS_ORDER = { "Em Andamento": 0, "Planejado": 1, "Concluído": 2 };
    const configReleases = releaseOrder
      .filter((id) => groups[id])
      .sort((a, b) => {
        const sa = STATUS_ORDER[releaseMap.get(a)?.status] ?? 99;
        const sb = STATUS_ORDER[releaseMap.get(b)?.status] ?? 99;
        return sa - sb;
      });
    const unknownReleases = Object.keys(groups).filter(
      (id) => id !== "__none__" && id !== "__pendente__" && !releaseMap.has(id)
    );
    const orderedKeys = [
      ...(groups["__pendente__"] ? ["__pendente__"] : []),
      ...(groups["__none__"]     ? ["__none__"]     : []),
      ...configReleases,
      ...unknownReleases,
    ];

    tbody.innerHTML = "";

    orderedKeys.forEach((key) => {
      const isNone       = key === "__none__";
      const isPendente   = key === "__pendente__";
      const releaseTasks = groups[key];
      const rel          = (isNone || isPendente) ? null : releaseMap.get(key);
      const relStatus    = rel ? rel.status : null;
      // Collapsed by default — expanded only if key is in the expanded Set
      const isCollapsed  = !expanded.has(key);

      const rc = isPendente          ? "var(--red)"     :
        isNone                       ? "#f59e0b"        :
        relStatus === "Concluído"    ? "var(--green)"   :
        relStatus === "Em Andamento" ? "var(--accent)"  : "#64748b";

      const groupLabel = isPendente ? "Pendente de Avaliação"
        : isNone ? "Pendente de Planejamento" : key;
      const groupBadge = isPendente
        ? `<span class="backlog-release-badge" style="background:var(--red-dk);color:var(--red);border:1px solid rgba(239,68,68,0.4)">🔴 Pendente</span>`
        : isNone
        ? `<span class="backlog-release-badge" style="background:#f59e0b18;color:#f59e0b;border:1px solid #f59e0b44">⚠ Sem Release</span>`
        : `<span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${relStatus}</span>`;

      // ── Cabeçalho da release ──
      const headerTr = document.createElement("tr");
      headerTr.className = "backlog-release-header" + (isNone ? " backlog-release-none" : "") + (isPendente ? " backlog-release-pendente" : "");
      headerTr.innerHTML = `
        <td colspan="13">
          <div class="backlog-release-header-inner">
            <button class="backlog-toggle-btn" title="${isCollapsed ? "Expandir" : "Recolher"}">
              ${isCollapsed ? "▶" : "▼"}
            </button>
            <span class="backlog-release-id" style="color:${rc}">${groupLabel}</span>
            ${groupBadge}
            ${rel ? `<span class="backlog-release-meta">${rel.produto} · Entrega: ${rel.dataFim}</span>` : ""}
            <span class="backlog-release-count">${releaseTasks.length} ticket${releaseTasks.length !== 1 ? "s" : ""}</span>
          </div>
        </td>`;
      headerTr.querySelector(".backlog-toggle-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        onToggle(key);
      });
      tbody.appendChild(headerTr);

      if (isCollapsed) return; // grupo recolhido — não renderiza linhas nem rodapé

      // Ordenação interna
      const sorted = [...releaseTasks].sort((a, b) => {
        const va = a[sortCol], vb = b[sortCol];
        if (typeof va === "string") return sortDir * va.localeCompare(vb);
        return sortDir * (va - vb);
      });

      // ── Linhas de tarefas ──
      sorted.forEach((t) => {
        const ss = config.STATUS_STYLE[t.status] || {};
        const ps = config.PRIO_STYLE[t.prioridade] || {};
        const ts = config.TIPO_STYLE[t.tipo] || { icon: "?", color: "#fff" };
        const origemColor = t.origem === "csv" ? "#f59e0b" : t.origem === "api" ? "#10b981" : "#475569";
        const origemLabel = t.origem === "csv" ? "📄 CSV"  : t.origem === "api" ? "🔌 API"  : "manual";

        const planejarBtn = (t.status === "Pendente" && userRole === "admin")
          ? `<button class="rel-action-btn" onclick="event.stopPropagation();planTask(${t.id})" title="Mover para Planejado" style="color:var(--accent)">▶ Planejar</button>`
          : "";

        const produtoColor = t.produto === "CLM" ? "#f59e0b" : t.produto === "ElawOn" ? "#a78bfa" : "var(--accent)";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-family:monospace;color:var(--muted);font-size:11px">#${t.id}</td>
          <td style="font-size:14px;color:${ts.color}">${ts.icon}</td>
          <td><span class="badge" style="background:${ps.bg};color:${ps.color};border:1px solid ${ps.color}30">${t.prioridade}</span></td>
          <td><span class="badge" style="background:${ss.bg};color:${ss.color};border:1px solid ${ss.color}30"><span class="badge-dot" style="background:${ss.dot}"></span>${t.status}</span></td>
          <td><div style="display:flex;gap:6px;align-items:center">${avatarHTML(t.dev, 20)}<span>${t.dev}</span></div></td>
          <td style="font-family:monospace;color:var(--accent);font-size:11px">${t.release || "—"}</td>
          <td style="font-family:monospace;color:${produtoColor};font-size:11px;font-weight:600">${t.produto || "—"}</td>
          <td style="color:var(--muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cliente}</td>
          <td style="color:var(--accent);font-family:monospace;text-align:right">${t.horasDev}</td>
          <td style="color:#f59e0b;font-family:monospace;text-align:right">${t.horasQa}</td>
          <td style="color:${origemColor};font-size:11px;font-weight:600">${origemLabel}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.desc}</td>
          <td>${planejarBtn}</td>`;
        tr.addEventListener("click", () => window.openModal(t));
        tbody.appendChild(tr);
      });

      // ── Rodapé com totais ──
      const totalDev = releaseTasks.reduce((a, t) => a + (t.horasDev || 0), 0);
      const totalQa  = releaseTasks.reduce((a, t) => a + (t.horasQa  || 0), 0);
      const done     = releaseTasks.filter((t) => t.status === "Concluído").length;
      const pct      = Math.round((done / releaseTasks.length) * 100);
      const pctColor = pct === 100 ? "var(--green)" : pct >= 50 ? "var(--accent)" : "var(--yellow)";

      const footerTr = document.createElement("tr");
      footerTr.className = "backlog-release-footer";
      footerTr.innerHTML = `
        <td colspan="8" style="text-align:right;color:var(--dim);font-size:11px">Totais da release</td>
        <td style="color:var(--accent);font-family:monospace;font-weight:700;text-align:right">${totalDev}h</td>
        <td style="color:#f59e0b;font-family:monospace;font-weight:700;text-align:right">${totalQa}h</td>
        <td colspan="3">
          <div class="backlog-release-progress">
            <span>${done}/${releaseTasks.length} concluídos</span>
            <div class="prog-bar-bg"><div class="prog-bar" style="width:${pct}%;background:${pctColor}"></div></div>
            <span style="color:${pctColor};font-weight:700;min-width:32px;text-align:right">${pct}%</span>
          </div>
        </td>`;
      tbody.appendChild(footerTr);
    });
  }

  /**
   * Renderiza o dashboard com KPIs, barras de status/release e cards de devs
   */
  static renderDashboard(tasks, config) {
    const stats        = getStats(tasks);
    const totalH       = stats.totalHours;
    const activeCount  = tasks.filter((t) => t.status !== "Concluído" && t.status !== "Bloqueado").length;
    const inProgCount  = tasks.filter((t) => t.status === "Em Desenvolvimento" || t.status === "Planejado").length;
    const homologCount = tasks.filter((t) => t.status === "Em Homologação - QA" || t.status === "Em Homologação - Cliente").length;

    // KPI cards — ordem: Total de Tarefas → Em Andamento → Em Homologação → Bloqueadas
    document.getElementById("kpi-grid").innerHTML = [
      { label: "Total de Tarefas", value: activeCount,   color: "var(--text)",   sub: `${totalH}h estimadas` },
      { label: "Em Andamento",     value: inProgCount,   color: "var(--accent)", sub: "Desenvolvimento e Planejado" },
      { label: "Em Homologação",   value: homologCount,  color: "var(--yellow)", sub: "QA e Cliente" },
      { label: "Bloqueadas",       value: stats.blocked, color: "var(--red)",    sub: "Requer atenção" },
    ].map((k) =>
      `<div class="kpi-card"><div class="kpi-label">${k.label}</div><div class="kpi-value" style="color:${k.color}">${k.value}</div><div class="kpi-sub">${k.sub}</div></div>`
    ).join("");

    // Barras por status
    document.getElementById("status-bars").innerHTML = config.STATUS_LIST.map((s) => {
      const n   = tasks.filter((t) => t.status === s).length;
      const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
      const ss  = config.STATUS_STYLE[s];
      return `<div class="prog-row">
        <div class="prog-labels">
          <div style="display:flex;gap:6px;align-items:center">
            <div class="badge-dot" style="background:${ss.dot}"></div>
            <span style="font-size:12px;color:var(--muted)">${s}</span>
          </div>
          <span style="font-size:12px;font-weight:600">${n} <span style="color:var(--dim)">(${pct}%)</span></span>
        </div>
        <div class="prog-bar-bg"><div class="prog-bar" style="width:${pct}%;background:${ss.dot}"></div></div>
      </div>`;
    }).join("");

    // Barras por release
    document.getElementById("release-bars").innerHTML = config.RELEASES.map((r) => {
      const rt = tasks.filter((t) => t.release === r.id);
      if (!rt.length) return "";
      const done = rt.filter((t) => t.status === "Concluído").length;
      const pct  = rt.length ? Math.round((done / rt.length) * 100) : 0;
      const hT   = rt.reduce((a, t) => a + t.horasDev + t.horasQa, 0);
      const rc   = { "Concluído": "var(--green)", "Em Andamento": "var(--accent)", "Planejado": "var(--slate)" }[r.status] || "var(--slate)";
      return `<div class="release-item">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <div>
            <span style="font-family:monospace;color:${rc};font-weight:700;font-size:13px">${r.id}</span>
            <span style="font-size:11px;color:var(--muted)"> ${r.produto}</span>
          </div>
          <span style="font-size:11px;color:var(--muted)">${done}/${rt.length} · ${hT}h</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:11px;color:var(--dim)">Entrega: ${r.dataFim}</span>
          <span style="font-size:11px;font-weight:700;color:${rc}">${pct}%</span>
        </div>
        <div class="prog-bar-bg"><div class="prog-bar" style="width:${pct}%;background:${rc}"></div></div>
      </div>`;
    }).join("");

    // Cards de desenvolvedores (usa DEVELOPERS se disponível, fallback para DEVS/DEV_HORAS)
    const devList = (config.DEVELOPERS && config.DEVELOPERS.length)
      ? config.DEVELOPERS.filter((d) => d.active !== false)
      : (config.DEVS || []).map((name) => ({ name, Enterprise: (config.DEV_HORAS[name] || 0) / 20 }));

    document.getElementById("dev-cards").innerHTML = devList.map((devObj) => {
      const d  = devObj.name;
      const dt = tasks.filter((t) => t.dev === d);
      if (!dt.length) return "";
      const hDev   = dt.reduce((a, t) => a + (t.horasDev || 0), 0);
      const hQa    = dt.reduce((a, t) => a + (t.horasQa  || 0), 0);
      const capMes = Math.round(((devObj.Enterprise || 0) + (devObj.CLM || 0) + (devObj.ElawOn || 0)) * 20);
      const cap    = capMes || 1;
      const pct    = Math.min(100, Math.round((hDev / cap) * 100));
      const col    = pct > 90 ? "var(--red)" : pct > 70 ? "var(--yellow)" : "var(--green)";
      const prodTags = [
        devObj.Enterprise > 0 && `<span style="font-size:9px;color:var(--accent)">Enterprise ${devObj.Enterprise}h/d</span>`,
        devObj.CLM > 0        && `<span style="font-size:9px;color:#f59e0b">CLM ${devObj.CLM}h/d</span>`,
        devObj.ElawOn > 0     && `<span style="font-size:9px;color:#a78bfa">ElawOn ${devObj.ElawOn}h/d</span>`,
      ].filter(Boolean).join(" · ");
      return `<div class="dev-card">
        <div class="dev-header">
          ${avatarHTML(d, 28)}
          <div>
            <p style="font-size:13px;font-weight:700">${d}</p>
            <p style="font-size:11px;color:var(--muted)">${dt.length} tarefas</p>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:11px;color:var(--muted)">${hDev}h DEV · ${hQa}h QA</span>
          <span style="font-size:11px;font-weight:700;color:${col}">${pct}%</span>
        </div>
        <div class="prog-bar-bg"><div class="prog-bar" style="width:${pct}%;background:${col}"></div></div>
        <p style="font-size:10px;color:var(--dim);margin-top:4px">${prodTags || `Cap: ${cap}h/mês`}</p>
      </div>`;
    }).join("");
  }

  /**
   * Atualiza os contadores de KPI da view Integrações
   */
  static updateIntegKpis(tasks) {
    const m = document.getElementById("cnt-manual");
    const c = document.getElementById("cnt-csv");
    const a = document.getElementById("cnt-api");
    if (m) m.textContent = tasks.filter((t) => t.origem === "manual").length;
    if (c) c.textContent = tasks.filter((t) => t.origem === "csv").length;
    if (a) a.textContent = tasks.filter((t) => t.origem === "api").length;
  }

  /**
   * Gera o SVG do gráfico burndown para uma release.
   *
   * Linha ideal (tracejada): decrescimento linear de totalEstimado → 0 ao longo dos dias úteis.
   * Linha real (azul): baseada nas horas dos tickets com status "Concluído" distribuídas
   *   linearmente ao longo do período, de forma que o gráfico reflita progresso mesmo sem
   *   apontamentos manuais. Se existirem apontamentos de horas (time_entries), eles são
   *   sobrepostos como marcadores diários.
   */
  static generateBurndownSVG(release, relTasks, timeEntries) {
    const parseDate = (s) => {
      if (!s) return null;
      if (s.includes("/")) { const [d, m, y] = s.split("/").map(Number); return new Date(y, m - 1, d); }
      if (s.includes("-")) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
      return null;
    };

    const endDate = parseDate(release.dataFim);
    if (!endDate) return '<p style="color:var(--muted);font-size:12px;text-align:center;padding:16px 0">Data de fim da release é necessária para gerar o burndown.</p>';

    // dataInicio opcional: estima a partir do ticket mais antigo ou 30 dias antes do fim
    let startDate = parseDate(release.dataInicio);
    let startEstimated = false;
    if (!startDate) {
      const earliest = relTasks.reduce((min, t) => {
        if (!t.dataReg) return min;
        const d = parseDate(t.dataReg);
        return d && (!min || d < min) ? d : min;
      }, null);
      startDate = earliest || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      startEstimated = true;
      if (startDate >= endDate) startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const totalEstimated = relTasks.reduce((a, t) => a + (t.horasDev || 0) + (t.horasQa || 0), 0);
    if (!totalEstimated) return '<p style="color:var(--muted);font-size:12px;text-align:center;padding:16px 0">Sem horas estimadas — adicione estimativas nos tickets para gerar o burndown.</p>';

    // Horas já concluídas (baseadas no status dos tickets — não requer apontamentos)
    const horasConcluidas = relTasks
      .filter((t) => t.status === "Concluído")
      .reduce((a, t) => a + (t.horasDev || 0) + (t.horasQa || 0), 0);

    // Dias úteis
    const holidays = new Set();
    for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
      if (typeof getHolidaysBR === "function") getHolidaysBR(y).forEach((h) => holidays.add(h));
    }
    const days = [];
    const cur  = new Date(startDate);
    while (cur <= endDate) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6 && !holidays.has(cur.toISOString().slice(0, 10))) days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (!days.length) { days.push(new Date(startDate)); days.push(new Date(endDate)); }

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // ── Linha real: dois pontos fixos ──────────────────────────────────────────
    // Ponto inicial: dia 0, remaining = totalEstimated
    // Ponto atual:   hoje (ou último dia útil da release se já encerrada),
    //                remaining = totalEstimated - horasConcluidas
    const todayIdx = (() => {
      // índice do dia útil mais próximo de hoje (ou do último dia se release encerrada)
      let best = 0;
      for (let i = 0; i < days.length; i++) {
        if (days[i] <= today) best = i;
        else break;
      }
      return best;
    })();
    const remainingNow = Math.max(0, totalEstimated - horasConcluidas);

    // ── Linha Real (laranja): soma das horas apontadas nos tickets concluídos ─
    // Mesmo comportamento da linha Esperado (2 pontos: início → hoje),
    // mas o "burned" é a soma de time_entries dos tickets com status Concluído.
    const concludedIds = new Set(relTasks.filter((t) => t.status === "Concluído").map((t) => t.id));
    const apontadoConcluidos = timeEntries
      .filter((e) => concludedIds.has(e.taskId))
      .reduce((a, e) => a + (e.horas || 0), 0);
    const remainingReal = Math.max(0, totalEstimated - apontadoConcluidos);
    const hasApont = apontadoConcluidos > 0;

    // ── SVG ───────────────────────────────────────────────────────────────────
    const W = 480, H = 230;
    const PAD = { top: 16, right: 16, bottom: 36, left: 52 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const n = days.length;

    const xScale = (i) => PAD.left + (i / Math.max(1, n - 1)) * plotW;
    const yScale = (h) => PAD.top + plotH - (h / totalEstimated) * plotH;

    // Linha ideal (tracejada cinza)
    const idealPts = days.map((_, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(totalEstimated * (1 - i / Math.max(1, n - 1))).toFixed(1)}`).join(" ");

    // Linha esperado (azul): progresso por conclusão de tickets (2 pontos: início → hoje)
    const espPath = `M${xScale(0).toFixed(1)},${yScale(totalEstimated).toFixed(1)} L${xScale(todayIdx).toFixed(1)},${yScale(remainingNow).toFixed(1)}`;

    // Linha real (laranja): 2 pontos âncora, igual à Esperado mas com apontamentos
    const realPath = hasApont
      ? `M${xScale(0).toFixed(1)},${yScale(totalEstimated).toFixed(1)} L${xScale(todayIdx).toFixed(1)},${yScale(remainingReal).toFixed(1)}`
      : null;

    // Eixo X labels
    const labelIdxs = [...new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1].filter((v) => v < n))];
    const xLabels = labelIdxs.map((i) => {
      const d = days[i];
      return `<text x="${xScale(i).toFixed(1)}" y="${H - PAD.bottom + 15}" text-anchor="middle" font-size="9" fill="#64748b">${d.getDate()}/${d.getMonth() + 1}</text>`;
    }).join("");

    // Eixo Y labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const h = Math.round(totalEstimated * f);
      return `<text x="${PAD.left - 6}" y="${(yScale(h) + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748b">${h}h</text>`;
    }).join("");

    // Grid lines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const y = yScale(totalEstimated * f).toFixed(1);
      return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#1e2d45" stroke-width="1"/>`;
    }).join("");

    // Linha vertical "hoje"
    const todayLine = (today >= days[0] && today <= days[days.length - 1])
      ? `<line x1="${xScale(todayIdx).toFixed(1)}" y1="${PAD.top}" x2="${xScale(todayIdx).toFixed(1)}" y2="${H - PAD.bottom}" stroke="#334155" stroke-width="1" stroke-dasharray="3,3"/>`
      : "";

    // Stats
    const pct       = Math.round((horasConcluidas / totalEstimated) * 100);
    const pctReal   = hasApont ? Math.round((apontadoConcluidos / totalEstimated) * 100) : null;
    const burnColor = pct >= 90 ? "#10b981" : pct >= 50 ? "#0ea5e9" : "#f59e0b";
    const realColor = pctReal !== null ? (pctReal >= 90 ? "#10b981" : pctReal >= 50 ? "#f59e0b" : "#ef4444") : "#f59e0b";

    // Legenda (sempre 3 entradas: Ideal + Esperado + Real; Real aparece mesmo sem dados)
    const legendY1 = PAD.top + 7, legendY2 = PAD.top + 20, legendY3 = PAD.top + 33;
    const legendX  = W - 146;
    const legend = `
      <line x1="${legendX}" y1="${legendY1}" x2="${legendX + 18}" y2="${legendY1}" stroke="#475569" stroke-width="1.5" stroke-dasharray="5,3"/>
      <text x="${legendX + 22}" y="${legendY1 + 4}" font-size="9" fill="#64748b">Ideal</text>
      <line x1="${legendX}" y1="${legendY2}" x2="${legendX + 18}" y2="${legendY2}" stroke="#0ea5e9" stroke-width="2"/>
      <text x="${legendX + 22}" y="${legendY2 + 4}" font-size="9" fill="#0ea5e9">Esperado (concluído)</text>
      <line x1="${legendX}" y1="${legendY3}" x2="${legendX + 18}" y2="${legendY3}" stroke="#f59e0b" stroke-width="2"/>
      <text x="${legendX + 22}" y="${legendY3 + 4}" font-size="9" fill="#f59e0b">Real (apontado)</text>`;

    return `
      ${startEstimated ? `<p style="color:#f59e0b;font-size:10px;margin:0 0 6px">⚠ Data de início não configurada na release — período estimado.</p>` : ""}
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;display:flex;gap:16px;flex-wrap:wrap">
        <span>Total estimado: <strong style="color:var(--text)">${totalEstimated}h</strong></span>
        <span>Esperado concluído: <strong style="color:${burnColor}">${horasConcluidas}h (${pct}%)</strong></span>
        <span>Apontado concluído: <strong style="color:#f59e0b">${apontadoConcluidos}h${pctReal !== null ? ` (${pctReal}%)` : ""}</strong></span>
        <span>Restante: <strong style="color:var(--text)">${remainingNow}h</strong></span>
      </div>
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">
        ${gridLines}
        ${todayLine}
        <path d="${idealPts}" stroke="#475569" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>
        <path d="${espPath}" stroke="#0ea5e9" stroke-width="2" fill="none"/>
        <circle cx="${xScale(0).toFixed(1)}" cy="${yScale(totalEstimated).toFixed(1)}" r="3" fill="#0ea5e9"/>
        <circle cx="${xScale(todayIdx).toFixed(1)}" cy="${yScale(remainingNow).toFixed(1)}" r="4" fill="#0ea5e9"/>
        ${realPath ? `<path d="${realPath}" stroke="#f59e0b" stroke-width="2" fill="none"/>
        <circle cx="${xScale(0).toFixed(1)}" cy="${yScale(totalEstimated).toFixed(1)}" r="3" fill="#f59e0b"/>
        <circle cx="${xScale(todayIdx).toFixed(1)}" cy="${yScale(remainingReal).toFixed(1)}" r="4" fill="#f59e0b"/>` : ""}
        <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${H - PAD.bottom}" stroke="#2a4060" stroke-width="1"/>
        <line x1="${PAD.left}" y1="${H - PAD.bottom}" x2="${W - PAD.right}" y2="${H - PAD.bottom}" stroke="#2a4060" stroke-width="1"/>
        ${xLabels}
        ${yLabels}
        ${legend}
      </svg>`;
  }

  /**
   * Atualiza o badge numérico no botão "Integrações" da navbar
   */
  static updateNavBadge(tasks) {
    const n      = tasks.filter((t) => t.origem !== "manual").length;
    const navBtn = document.getElementById("nav-integ");
    if (!navBtn) return;
    let badgeEl = navBtn.querySelector(".badge");
    if (n > 0) {
      if (!badgeEl) {
        badgeEl = document.createElement("span");
        badgeEl.className = "badge";
        navBtn.appendChild(badgeEl);
      }
      badgeEl.textContent = n;
    } else if (badgeEl) {
      badgeEl.remove();
    }
  }
}
