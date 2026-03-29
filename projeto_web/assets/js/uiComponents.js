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
  static renderBacklog(tasks, config, sortCol, sortDir) {
    const tbody = document.getElementById("backlog-body");
    if (!tbody) return;

    const sorted = [...tasks].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "string") return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });

    // Atualiza indicadores de ordenação nos headers
    document.querySelectorAll("#backlog-table th[data-col]").forEach((th) => {
      th.classList.toggle("sort-active", th.dataset.col === sortCol);
      th.textContent = th.textContent.replace(/ [↑↓]/, "");
      if (th.dataset.col === sortCol)
        th.textContent += sortDir === 1 ? " ↑" : " ↓";
    });

    tbody.innerHTML = "";
    sorted.forEach((t) => {
      const ss = config.STATUS_STYLE[t.status] || {};
      const ps = config.PRIO_STYLE[t.prioridade] || {};
      const ts = config.TIPO_STYLE[t.tipo] || { icon: "?", color: "#fff" };
      const origemColor =
        t.origem === "csv" ? "#f59e0b" :
        t.origem === "api" ? "#10b981" : "#475569";
      const origemLabel =
        t.origem === "csv" ? "📄 CSV" :
        t.origem === "api" ? "🔌 API" : "manual";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-family:monospace;color:var(--muted);font-size:11px">#${t.id}</td>
        <td style="font-size:14px;color:${ts.color}">${ts.icon}</td>
        <td><span class="badge" style="background:${ps.bg};color:${ps.color};border:1px solid ${ps.color}30">${t.prioridade}</span></td>
        <td><span class="badge" style="background:${ss.bg};color:${ss.color};border:1px solid ${ss.color}30"><span class="badge-dot" style="background:${ss.dot}"></span>${t.status}</span></td>
        <td><div style="display:flex;gap:6px;align-items:center">${avatarHTML(t.dev, 20)}<span>${t.dev}</span></div></td>
        <td style="font-family:monospace;color:var(--accent);font-size:11px">${t.release}</td>
        <td style="color:var(--muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cliente}</td>
        <td style="color:var(--accent);font-family:monospace;text-align:right">${t.horasDev}</td>
        <td style="color:#f59e0b;font-family:monospace;text-align:right">${t.horasQa}</td>
        <td style="color:${origemColor};font-size:11px;font-weight:600">${origemLabel}</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.desc}</td>`;
      tr.addEventListener("click", () => window.openModal(t));
      tbody.appendChild(tr);
    });
  }

  /**
   * Renderiza o dashboard com KPIs, barras de status/release e cards de devs
   */
  static renderDashboard(tasks, config) {
    const stats   = getStats(tasks);
    const totalH  = stats.totalHours;

    // KPI cards
    document.getElementById("kpi-grid").innerHTML = [
      { label: "Total de Tarefas", value: stats.total,     color: "var(--text)",   sub: `${totalH}h estimadas` },
      { label: "Concluídas",       value: stats.completed, color: "var(--green)",  sub: `${stats.hoursCompleted}h entregues` },
      { label: "Em Andamento",     value: stats.inProgress,color: "var(--accent)", sub: "Dev + QA + Cliente" },
      { label: "Bloqueadas",       value: stats.blocked,   color: "var(--red)",    sub: "Requer atenção" },
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

    // Cards de desenvolvedores
    document.getElementById("dev-cards").innerHTML = config.DEVS.map((d) => {
      const dt = tasks.filter((t) => t.dev === d);
      if (!dt.length) return "";
      const hDev = dt.reduce((a, t) => a + t.horasDev, 0);
      const hQa  = dt.reduce((a, t) => a + t.horasQa,  0);
      const cap  = config.DEV_HORAS[d] || 1;
      const pct  = Math.min(100, Math.round((hDev / cap) * 100));
      const col  = pct > 90 ? "var(--red)" : pct > 70 ? "var(--yellow)" : "var(--green)";
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
        <p style="font-size:10px;color:var(--dim);margin-top:4px">Cap: ${cap}h/mês</p>
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
