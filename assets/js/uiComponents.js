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

        card.innerHTML = `
          <div class="card-top">
            <span class="card-id">#${t.id}</span>
            <span>${origemTag}<span style="font-size:13px">${ts.icon}</span></span>
          </div>
          <p class="card-desc">${t.desc}</p>
          <p class="card-client">${t.cliente}</p>
          <div class="card-footer">
            <span class="badge" style="background:${ps.bg};color:${ps.color};border:1px solid ${ps.color}30;font-size:10px">${t.prioridade}</span>
            ${avatarHTML(t.dev, 22)}
          </div>`;

        body.appendChild(card);
      });
    });
  }

  /**
   * Renderiza a tabela de backlog com ordenação por coluna
   */
  static renderBacklog(tasks, config, sortCol, sortDir, collapsed = new Set(), onToggle = () => {}) {
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

    // Agrupa tasks — release vazia/nula → chave especial "__none__"
    const groups = {};
    tasks.forEach((t) => {
      const key = (t.release || "").trim() || "__none__";
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
      (id) => id !== "__none__" && !releaseMap.has(id)
    );
    const orderedKeys = [
      ...(groups["__none__"] ? ["__none__"] : []),
      ...configReleases,
      ...unknownReleases,
    ];

    tbody.innerHTML = "";

    orderedKeys.forEach((key) => {
      const isNone       = key === "__none__";
      const releaseTasks = groups[key];
      const rel          = isNone ? null : releaseMap.get(key);
      const relStatus    = rel ? rel.status : null;
      const isCollapsed  = collapsed.has(key);

      const rc = isNone            ? "#f59e0b"        :
        relStatus === "Concluído"  ? "var(--green)"   :
        relStatus === "Em Andamento" ? "var(--accent)" : "#64748b";

      // ── Cabeçalho da release ──
      const headerTr = document.createElement("tr");
      headerTr.className = "backlog-release-header" + (isNone ? " backlog-release-none" : "");
      headerTr.innerHTML = `
        <td colspan="11">
          <div class="backlog-release-header-inner">
            <button class="backlog-toggle-btn" title="${isCollapsed ? "Expandir" : "Recolher"}">
              ${isCollapsed ? "▶" : "▼"}
            </button>
            <span class="backlog-release-id" style="color:${rc}">
              ${isNone ? "Pendente de Planejamento" : key}
            </span>
            ${isNone
              ? `<span class="backlog-release-badge" style="background:#f59e0b18;color:#f59e0b;border:1px solid #f59e0b44">⚠ Sem Release</span>`
              : `<span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${relStatus}</span>`
            }
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

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-family:monospace;color:var(--muted);font-size:11px">#${t.id}</td>
          <td style="font-size:14px;color:${ts.color}">${ts.icon}</td>
          <td><span class="badge" style="background:${ps.bg};color:${ps.color};border:1px solid ${ps.color}30">${t.prioridade}</span></td>
          <td><span class="badge" style="background:${ss.bg};color:${ss.color};border:1px solid ${ss.color}30"><span class="badge-dot" style="background:${ss.dot}"></span>${t.status}</span></td>
          <td><div style="display:flex;gap:6px;align-items:center">${avatarHTML(t.dev, 20)}<span>${t.dev}</span></div></td>
          <td style="font-family:monospace;color:var(--accent);font-size:11px">${t.release || "—"}</td>
          <td style="color:var(--muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cliente}</td>
          <td style="color:var(--accent);font-family:monospace;text-align:right">${t.horasDev}</td>
          <td style="color:#f59e0b;font-family:monospace;text-align:right">${t.horasQa}</td>
          <td style="color:${origemColor};font-size:11px;font-weight:600">${origemLabel}</td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.desc}</td>`;
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
        <td colspan="7" style="text-align:right;color:var(--dim);font-size:11px">Totais da release</td>
        <td style="color:var(--accent);font-family:monospace;font-weight:700;text-align:right">${totalDev}h</td>
        <td style="color:#f59e0b;font-family:monospace;font-weight:700;text-align:right">${totalQa}h</td>
        <td colspan="2">
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
