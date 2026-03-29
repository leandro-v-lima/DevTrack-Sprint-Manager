/**
 * DevTrack Sprint Manager — Controlador Principal
 *
 * Orquestra toda a aplicação: estado, eventos, views e comunicação
 * com o SupabaseDataProvider.
 *
 * ══════════════════════════════════════════════════════════════
 *  ⚙️  CONFIGURAÇÃO DO SUPABASE
 *  Substitua os valores abaixo com os do seu projeto Supabase:
 *    1. Acesse supabase.com → seu projeto → Settings → API
 *    2. Copie "Project URL" e "anon public" key
 *  A chave anon é pública por design — proteja o acesso via RLS.
 * ══════════════════════════════════════════════════════════════
 Senha base de dados: .s&,9@#7Kq+QWE4
 */
const SUPABASE_URL      = "https://qfmmodvpyzyfwwigcnji.supabase.co";       // ex: https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_t2luDeSJKRvt3G4C3vek8A_z9W2Xm07";     // ex: eyJhbGciOiJIUzI1NiIsInR5...


// ═══════════════════════════════════════════════════════════════════════════
// CLASSE PRINCIPAL DA APLICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

class DevTrackApp {
  constructor(dataProvider, config) {
    this.dataProvider = dataProvider;
    this.config       = config;

    // Estado da aplicação
    this.tasks                = [];
    this.users                = [];
    this.currentTask          = null;
    this.isNewTask            = false;
    this.isNewUser            = false;
    this.modalMode            = "task";      // "task" | "release" | "user"
    this.currentHomepageFilter = "Em Andamento";
    this.sortCol              = "id";
    this.sortDir              = -1;
    this.importLog            = [];
    this.csvPreview           = [];
    this.pollingOn            = false;
    this.pollingTimer         = null;
    this.currentView          = "kanban";
    this.currentUser          = null;
    this.isAuthenticated      = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  async init() {
    console.log("🚀 Inicializando DevTrack...");
    try {
      await this.dataProvider.init();

      // Carregar tarefas (fallback para INITIAL_TASKS se vazio)
      this.tasks = await this.dataProvider.getTasks();
      if (!this.tasks.length) {
        this.tasks = JSON.parse(JSON.stringify(this.config.INITIAL_TASKS));
      }

      // Carregar usuários (fallback para config)
      this.users = await this.dataProvider.getUsers();
      if (!this.users || !this.users.length) {
        this.users = JSON.parse(JSON.stringify(this.config.USERS));
      }

      // Carregar releases do provider e atualizar config
      const releases = await this.dataProvider.getReleases();
      if (releases && releases.length) {
        this.config.RELEASES = releases;
      }

      // Mostrar apenas a tela de login inicialmente
      document.getElementById("view-login").classList.add("active");
      document.getElementById("topbar").style.display    = "none";
      document.getElementById("filterbar").style.display = "none";
      document.getElementById("content").style.display   = "none";

      // Indicador de modo (memória vs Supabase)
      if (this.dataProvider.isConnected && !this.dataProvider.isConnected()) {
        console.warn("⚠️  Modo memória — dados não são persistidos entre sessões.");
      }

      this.bindEvents();
      console.log(`✓ DevTrack pronto! ${this.tasks.length} tarefa(s) carregada(s).`);
    } catch (err) {
      console.error("✗ Erro ao inicializar:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELECTS / DROPDOWNS
  // ─────────────────────────────────────────────────────────────────────────

  populateSelects() {
    const defaults = {
      "f-status":  "Todos os status",
      "f-dev":     "Todos os devs",
      "f-release": "Todas as releases",
      "f-tipo":    "Todos os tipos",
      "m-status":  "Selecione o status",
      "m-dev":     "Selecione o dev",
      "m-release": "Selecione a release",
      "m-prio":    "Selecione a prioridade",
      "m-tipo":    "Selecione o tipo",
      "m-classif": "Selecione a classificação",
      "m-modulo":  "Selecione o módulo",
    };

    const add = (id, opts) => {
      const s = document.getElementById(id);
      if (!s) return;
      s.innerHTML = `<option value="">${defaults[id] || "Selecione"}</option>`;
      opts.forEach((o) => {
        const el = document.createElement("option");
        el.value = o; el.textContent = o;
        s.appendChild(el);
      });
    };

    add("f-status",  this.config.STATUS_LIST);
    add("f-dev",     this.config.DEVS);
    add("f-release", this.config.RELEASES.map((r) => r.id));
    add("f-tipo",    this.config.TIPOS);
    add("m-status",  this.config.STATUS_LIST);
    add("m-dev",     this.config.DEVS);
    add("m-release", this.config.RELEASES.map((r) => r.id));
    add("m-prio",    this.config.PRIORIDADES);
    add("m-tipo",    this.config.TIPOS);
    add("m-classif", this.config.CLASSIFICACOES);
    add("m-modulo",  this.config.MODULOS);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENTOS
  // ─────────────────────────────────────────────────────────────────────────

  bindEvents() {
    // Navegação
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.addEventListener("click", () => this.switchView(b.dataset.view))
    );

    // Tabs (integrações)
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.addEventListener("click", () => this.switchTab(b.dataset.tab))
    );

    // Botões globais
    document.getElementById("btn-new")?.addEventListener("click", () => this.openNewModal());
    document.getElementById("btn-new-release")?.addEventListener("click", () => this.openNewRelease());
    document.getElementById("btn-logout")?.addEventListener("click", () => this.logout());

    // Busca e filtros
    document.getElementById("search")?.addEventListener("input", () => this.renderAll());
    ["f-status", "f-dev", "f-release", "f-tipo"].forEach((id) =>
      document.getElementById(id)?.addEventListener("change", () => this.renderAll())
    );

    // Ordenação do backlog (clique nos headers)
    document.querySelectorAll("#backlog-table th[data-col]").forEach((th) =>
      th.addEventListener("click", () => {
        if (this.sortCol === th.dataset.col) this.sortDir *= -1;
        else { this.sortCol = th.dataset.col; this.sortDir = 1; }
        this.renderBacklog(this.getFiltered());
      })
    );

    // CSV
    document.getElementById("csv-file")?.addEventListener("change", (e) => this.handleCsvFile(e));
    document.getElementById("btn-test-api")?.addEventListener("click", () => this.testApi());
    document.getElementById("btn-sync")?.addEventListener("click", () => this.syncNow());
    document.getElementById("confirm-import")?.addEventListener("click", () => this.confirmImport());

    // Gestão de usuários
    document.getElementById("btn-new-user")?.addEventListener("click", () => this.openNewUserModal());
    document.getElementById("user-list-body")?.addEventListener("click", (e) => {
      if (e.target.matches("button.user-delete")) { this.removeUser(e.target.dataset.username); return; }
      if (e.target.matches("button.user-edit"))   { this.openEditUser(e.target.dataset.username); }
    });

    // Modal — fechar ao clicar fora
    document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVEGAÇÃO DE VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  switchView(v) {
    this.currentView = v;
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v)
    );
    document.querySelectorAll(".view").forEach((el) =>
      el.classList.toggle("active", el.id === "view-" + v)
    );
    document.getElementById("filterbar").style.display =
      v === "integrations" || v === "homepage" || v === "users" ? "none" : "";

    if (v === "integrations") this.updateIntegKpis();
    if (v === "homepage")     { this.currentHomepageFilter = this.currentHomepageFilter || "Em Andamento"; this.renderHomepage(); }
    if (v === "users")        this.renderUsers();
    this.renderAll();
  }

  switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab)
    );
    document.querySelectorAll(".tab-content").forEach((el) =>
      el.classList.toggle("active", el.id === tab)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILTROS
  // ─────────────────────────────────────────────────────────────────────────

  getFiltered() {
    const q  = document.getElementById("search")?.value?.toLowerCase()  || "";
    const fs = document.getElementById("f-status")?.value  || "";
    const fd = document.getElementById("f-dev")?.value     || "";
    const fr = document.getElementById("f-release")?.value || "";
    const ft = document.getElementById("f-tipo")?.value    || "";

    return this.tasks.filter((t) => {
      if (q  && !t.desc.toLowerCase().includes(q) && !t.cliente.toLowerCase().includes(q) && !String(t.id).includes(q)) return false;
      if (fs && t.status   !== fs) return false;
      if (fd && t.dev      !== fd) return false;
      if (fr && t.release  !== fr) return false;
      if (ft && t.tipo     !== ft) return false;
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER GERAL
  // ─────────────────────────────────────────────────────────────────────────

  renderAll() {
    const filtered = this.getFiltered();
    const countEl  = document.getElementById("filter-count");
    if (countEl) countEl.textContent = filtered.length + " de " + this.tasks.length + " tarefas";

    if (this.currentView === "homepage")  this.renderHomepage();
    if (this.currentView === "users")     this.renderUsers();
    if (this.currentView === "kanban")    this.renderKanban(filtered);
    if (this.currentView === "backlog")   this.renderBacklog(filtered);
    if (this.currentView === "dashboard") this.renderDashboard(filtered);
  }

  renderKanban(filtered)    { UIComponents.renderKanban(filtered, this.config); }
  renderBacklog(filtered)   { UIComponents.renderBacklog(filtered, this.config, this.sortCol, this.sortDir); }
  renderDashboard(filtered) { UIComponents.renderDashboard(filtered, this.config); }

  // ─────────────────────────────────────────────────────────────────────────
  // HOMEPAGE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna as tarefas do usuário logado (match por name/username/email)
   */
  getTasksForUser(user) {
    if (!user) return [];
    const userName  = (user.name     || "").trim().toLowerCase();
    const userLogin = (user.username || "").trim().toLowerCase();
    return this.tasks.filter((t) => {
      const dev = (t.dev || "").trim().toLowerCase();
      return (userName && dev === userName) || (userLogin && dev === userLogin);
    });
  }

  renderHomepage() {
    if (!this.currentUser) return;
    const userTasks = this.getTasksForUser(this.currentUser);
    const stats     = getStats(userTasks);

    // KPIs clicáveis
    const cards = [
      { label: "Minhas Tarefas", value: stats.total,      color: "var(--text)",   sub: `${stats.totalHours}h estimadas` },
      { label: "Concluídas",     value: stats.completed,  color: "var(--green)",  sub: `${stats.hoursCompleted}h` },
      { label: "Em Andamento",   value: stats.inProgress, color: "var(--accent)", sub: "Desenvolvimento" },
      { label: "Bloqueadas",     value: stats.blocked,    color: "var(--red)",    sub: "Requer atenção" },
    ];

    document.getElementById("homepage-kpi-grid").innerHTML = cards.map((k) =>
      `<div class="kpi-card homepage-filter${this.currentHomepageFilter === k.label ? " active" : ""}" data-filter="${k.label}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`
    ).join("");

    document.querySelectorAll(".homepage-filter").forEach((card) => {
      card.addEventListener("click", () => {
        this.currentHomepageFilter = card.dataset.filter;
        this.renderHomepage();
      });
    });

    // Filtro de tarefas pelo KPI clicado
    const statusMap = {
      "Minhas Tarefas": null,
      "Concluídas":     "Concluído",
      "Em Andamento":   "Em Desenvolvimento",
      "Bloqueadas":     "Bloqueado",
    };
    const requiredStatus  = statusMap[this.currentHomepageFilter];
    const filteredTasks   = requiredStatus
      ? userTasks.filter((t) => t.status === requiredStatus)
      : userTasks;

    // Barras de status
    document.getElementById("homepage-status-bars").innerHTML =
      this.config.STATUS_LIST.map((s) => {
        const n   = userTasks.filter((t) => t.status === s).length;
        const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
        const ss  = this.config.STATUS_STYLE[s];
        return `<div class="prog-row">
          <div class="prog-labels">
            <div style="display:flex;gap:6px;align-items:center">
              <div class="badge-dot" style="background:${ss.dot}"></div>
              <span style="font-size:12px;color:var(--muted)">${s}</span>
            </div>
            <span style="font-size:12px;font-weight:600">${n}</span>
          </div>
          <div class="prog-bar-bg"><div class="prog-bar" style="width:${pct}%;background:${ss.dot}"></div></div>
        </div>`;
      }).join("");

    // Resumo de horas (BUGFIX: usa stats.devHours e stats.qaHours agora corretos)
    const cap = this.currentUser.horas_disponivel || 0;
    document.getElementById("homepage-hours-summary").innerHTML = `
      <div class="hours-summary-item">
        <span class="hours-label">Dev (estimada)</span>
        <span class="hours-value" style="color:var(--accent)">${stats.devHours}h</span>
      </div>
      <div class="hours-summary-item">
        <span class="hours-label">QA (estimada)</span>
        <span class="hours-value" style="color:var(--yellow)">${stats.qaHours}h</span>
      </div>
      <div class="hours-summary-item">
        <span class="hours-label">Capacidade</span>
        <span class="hours-value" style="color:var(--green)">${cap}h</span>
      </div>
      <div class="hours-summary-item" style="border-bottom:none">
        <span class="hours-label">Utilização</span>
        <span class="hours-value">${Math.round((stats.devHours / (cap || 1)) * 100)}%</span>
      </div>`;

    // Lista de tarefas (até 5 itens)
    const recentTasks = filteredTasks.slice(0, 5);
    document.getElementById("homepage-tasks-list-title").textContent = "Lista de Tarefas";
    document.getElementById("homepage-tasks-list").innerHTML = recentTasks.length
      ? recentTasks.map((t) => `
          <div class="homepage-task-item" data-task-id="${t.id}">
            <div class="homepage-task-id">#${t.id}</div>
            <div class="homepage-task-desc">${t.desc}</div>
            <div class="homepage-task-meta">
              <span>${t.cliente}</span>
              <span style="color:var(--muted)">${t.release}</span>
            </div>
          </div>`).join("")
      : '<p style="color:var(--muted);font-size:13px;text-align:center;padding:30px 0">Nenhuma tarefa disponível</p>';

    // Clicar na tarefa da homepage abre o modal
    document.querySelectorAll(".homepage-task-item[data-task-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const t = this.tasks.find((x) => x.id === Number(el.dataset.taskId));
        if (t) this.openModal(t);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USUÁRIOS (view)
  // ─────────────────────────────────────────────────────────────────────────

  renderUsers() {
    const tbody = document.getElementById("user-list-body");
    if (!tbody) return;
    tbody.innerHTML = (this.users || []).map((u) => `
      <tr>
        <td>${u.username || u.name}</td>
        <td>${u.name     || "-"}</td>
        <td>${u.role     || "-"}</td>
        <td>${u.horas_disponivel || 0}</td>
        <td>${u.active === false ? "Inativo" : "Ativo"}</td>
        <td>
          <button class="btn btn-primary btn-small user-edit"   data-username="${u.username || u.name}">Editar</button>
          <button class="btn btn-secondary btn-small user-delete" data-username="${u.username || u.name}">Excluir</button>
        </td>
      </tr>`).join("");
  }

  async removeUser(username) {
    if (!username) return;
    try {
      await this.dataProvider.deleteUser?.(username);
    } catch (_) { /* modo memória, ignora */ }
    this.users = this.users.filter((u) => (u.username || u.name) !== username);
    this.renderUsers();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL — controle de modo
  // ─────────────────────────────────────────────────────────────────────────

  _setModalMode(mode) {
    this.modalMode = mode;

    // Oculta todas as seções e mostra a correta
    ["modal-task-content", "modal-release-content", "modal-user-content"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("active", "block");
      el.style.display = "none";
    });

    const target = document.getElementById(
      mode === "task"    ? "modal-task-content"    :
      mode === "release" ? "modal-release-content" :
      "modal-user-content"
    );
    if (target) {
      target.style.display = "";
      target.classList.add("active");
      if (mode !== "task") target.classList.add("block");
    }

    const btnDelete = document.getElementById("btn-delete");
    if (btnDelete) btnDelete.style.display = mode === "task" ? "" : "none";
  }

  _fillTaskModal(t) {
    document.getElementById("modal-id").textContent = "#" + t.id;
    document.getElementById("modal-tipo-badge").innerHTML = badge(
      t.tipo, this.config.TIPO_STYLE[t.tipo]?.color || "#fff", "var(--bg)"
    );
    const origemC = t.origem === "csv" ? "#f59e0b" : t.origem === "api" ? "#10b981" : "";
    document.getElementById("modal-origem-badge").innerHTML = t.origem !== "manual"
      ? badge(t.origem === "csv" ? "📄 CSV" : "🔌 API", origemC, "var(--bg)")
      : "";

    document.getElementById("m-desc").value       = t.desc       || "";
    document.getElementById("m-cliente").value    = t.cliente    || "";
    document.getElementById("m-demandante").value = t.demandante || "";
    document.getElementById("m-ticket").value     = String(t.ticketOrc || "N/A");
    document.getElementById("m-data").value       = t.dataReg    || "";
    document.getElementById("m-hdev").value       = t.horasDev   || 0;
    document.getElementById("m-hqa").value        = t.horasQa    || 0;
    this.updateTotal();

    setSelect("m-status",  t.status);
    setSelect("m-dev",     t.dev);
    setSelect("m-release", t.release);
    setSelect("m-prio",    t.prioridade);
    setSelect("m-tipo",    t.tipo);
    setSelect("m-classif", t.classif);
    setSelect("m-modulo",  t.modulo);

    document.getElementById("btn-save").textContent = this.isNewTask ? "✚ Criar Tarefa" : "Salvar";
    document.getElementById("modal-overlay").classList.add("open");
  }

  openModal(t) {
    this.currentTask = t;
    this.isNewTask   = false;
    this._setModalMode("task");
    this._fillTaskModal(t);
  }

  openNewModal() {
    this.currentTask = {
      id:         Math.floor(Math.random() * 10000) + 150000,
      ticketOrc:  "N/A",
      horasDev:   0,
      horasQa:    0,
      tipo:       "NOVA FEATURE",
      classif:    "Evolução",
      modulo:     "Geral",
      cliente:    "",
      desc:       "",
      release:    this.config.RELEASES[0]?.id || "",
      prioridade: "Média",
      status:     "Planejado",
      dev:        this.config.DEVS[0] || "",
      demandante: "",
      dataReg:    new Date().toLocaleDateString("pt-BR"),
      origem:     "manual",
      origemId:   "",
    };
    this.isNewTask = true;
    this.isNewUser = false;
    this._setModalMode("task");
    this._fillTaskModal(this.currentTask);
    document.getElementById("btn-delete").style.display = "none";
    document.getElementById("btn-save").textContent     = "✚ Criar Tarefa";
  }

  openNewRelease() {
    this._setModalMode("release");
    document.getElementById("modal-id").textContent           = "#Nova";
    document.getElementById("modal-tipo-badge").textContent   = "Nova Release";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("r-id").value      = "";
    document.getElementById("r-produto").value = "Enterprise";
    document.getElementById("r-inicio").value  = "";
    document.getElementById("r-fim").value     = "";
    document.getElementById("r-status").value  = "Planejado";
    document.getElementById("btn-save").textContent = "✚ Criar Release";
    document.getElementById("modal-overlay").classList.add("open");
  }

  openNewUserModal() {
    this.isNewUser = true;
    this._setModalMode("user");
    document.getElementById("modal-id").textContent           = "#Novo Usuário";
    document.getElementById("modal-tipo-badge").textContent   = "Usuário";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("u-username").value = "";
    document.getElementById("u-name").value     = "";
    document.getElementById("u-password").value = "";
    document.getElementById("u-horas").value    = "";
    document.getElementById("u-role").value     = "user";
    document.getElementById("u-active").value   = "true";
    document.getElementById("btn-save").textContent = "✚ Criar Usuário";
    document.getElementById("modal-overlay").classList.add("open");
  }

  openEditUser(username) {
    const user = this.users.find((u) => (u.username || u.name) === username);
    if (!user) return;
    this.isNewUser = false;
    this._setModalMode("user");
    document.getElementById("modal-id").textContent           = "#Editar Usuário";
    document.getElementById("modal-tipo-badge").textContent   = "Usuário";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("u-username").value = user.username || user.name;
    document.getElementById("u-name").value     = user.name || "";
    document.getElementById("u-password").value = user.password || "";
    document.getElementById("u-horas").value    = user.horas_disponivel || "";
    document.getElementById("u-role").value     = user.role || "user";
    document.getElementById("u-active").value   = user.active ? "true" : "false";
    document.getElementById("btn-save").textContent = "Salvar Usuário";
    document.getElementById("modal-overlay").classList.add("open");
  }

  closeModal() {
    document.getElementById("modal-overlay").classList.remove("open");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SALVAR / EXCLUIR
  // ─────────────────────────────────────────────────────────────────────────

  async saveTask() {
    // ── Salvar Release ──
    if (this.modalMode === "release") {
      const id       = document.getElementById("r-id").value.trim();
      const produto  = document.getElementById("r-produto").value;
      const dataInicio = document.getElementById("r-inicio").value;
      const dataFim  = document.getElementById("r-fim").value;
      const status   = document.getElementById("r-status").value;

      if (!id || !produto || !dataFim || !status) {
        alert("Preencha todos os campos da release.");
        return;
      }
      if (this.config.RELEASES.some((r) => r.id === id)) {
        alert("Release já existe.");
        return;
      }

      const newRelease = { id, produto, dataInicio, dataFim, status };
      try { await this.dataProvider.saveRelease?.(newRelease); } catch (_) {}
      this.config.RELEASES.push(newRelease);
      this.populateSelects();
      this.closeModal();
      this.renderAll();
      alert("Release criada com sucesso!");
      return;
    }

    // ── Salvar Usuário ──
    if (this.modalMode === "user") {
      const username = document.getElementById("u-username").value.trim();
      const name     = document.getElementById("u-name").value.trim();
      const password = document.getElementById("u-password").value.trim();
      const horas    = parseInt(document.getElementById("u-horas").value, 10) || 0;
      const role     = document.getElementById("u-role").value;
      const active   = document.getElementById("u-active").value === "true";

      if (!username || !name || !password) {
        alert("Preencha login, nome e senha do usuário.");
        return;
      }

      const existing = this.users.find((u) =>
        (u.username || u.name)?.toLowerCase() === username.toLowerCase()
      );
      if (this.isNewUser && existing) { alert("Usuário já existe."); return; }

      const userData = { username, name, password, horas_disponivel: horas, role, active };
      try { await this.dataProvider.saveUser?.(userData); } catch (_) {}

      if (existing && !this.isNewUser) {
        Object.assign(existing, userData);
      } else {
        this.users.push(userData);
      }

      this.renderUsers();
      this.closeModal();
      alert("Usuário salvo com sucesso!");
      return;
    }

    // ── Salvar Tarefa ──
    this.currentTask.desc       = document.getElementById("m-desc").value;
    this.currentTask.cliente    = document.getElementById("m-cliente").value;
    this.currentTask.demandante = document.getElementById("m-demandante").value;
    this.currentTask.ticketOrc  = document.getElementById("m-ticket").value;
    this.currentTask.dataReg    = document.getElementById("m-data").value;
    this.currentTask.horasDev   = parseInt(document.getElementById("m-hdev").value) || 0;
    this.currentTask.horasQa    = parseInt(document.getElementById("m-hqa").value)  || 0;
    this.currentTask.status     = document.getElementById("m-status").value;
    this.currentTask.dev        = document.getElementById("m-dev").value;
    this.currentTask.release    = document.getElementById("m-release").value;
    this.currentTask.prioridade = document.getElementById("m-prio").value;
    this.currentTask.tipo       = document.getElementById("m-tipo").value;
    this.currentTask.classif    = document.getElementById("m-classif").value;
    this.currentTask.modulo     = document.getElementById("m-modulo").value;

    try {
      if (this.isNewTask) {
        await this.dataProvider.createTask?.({ ...this.currentTask });
        this.tasks.push({ ...this.currentTask });
      } else {
        await this.dataProvider.saveTask?.({ ...this.currentTask });
        const idx = this.tasks.findIndex((t) => t.id === this.currentTask.id);
        if (idx >= 0) this.tasks[idx] = { ...this.currentTask };
      }
    } catch (err) {
      console.warn("saveTask (provider):", err.message, "— atualizado somente na memória.");
    }

    this.closeModal();
    this.renderAll();
    this.updateNavBadge();
  }

  async deleteTask() {
    if (!this.currentTask) return;
    try {
      await this.dataProvider.deleteTask?.(this.currentTask.id);
    } catch (_) {}
    this.tasks = this.tasks.filter((t) => t.id !== this.currentTask.id);
    this.closeModal();
    this.renderAll();
    this.updateNavBadge();
  }

  updateTotal() {
    const h = (parseInt(document.getElementById("m-hdev").value) || 0) +
              (parseInt(document.getElementById("m-hqa").value)  || 0);
    const el = document.getElementById("m-htotal");
    if (el) el.textContent = h;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRAÇÕES
  // ─────────────────────────────────────────────────────────────────────────

  updateIntegKpis()  { UIComponents.updateIntegKpis(this.tasks); }
  updateNavBadge()   { UIComponents.updateNavBadge(this.tasks); }

  // CSV
  async handleCsvFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    showAlert("csv-alert", "", "");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        this.csvPreview = CSVHandler.parseCSV(ev.target.result);
        if (!this.csvPreview.length) {
          showAlert("csv-alert", "Nenhuma linha válida encontrada.", "error");
          return;
        }
        CSVHandler.renderPreview(this.csvPreview, this.tasks);
      } catch (err) {
        showAlert("csv-alert", "Erro ao ler o arquivo: " + err.message, "error");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  async confirmImport() {
    const existingIds = new Set(this.tasks.map((t) => t.origemId || String(t.id)));
    const news  = this.csvPreview.filter((t) => !existingIds.has(t.origemId));
    const dupes = this.csvPreview.length - news.length;

    this.tasks.push(...news);
    this.addLog("csv", this.csvPreview.length, news.length, dupes);

    // Persiste no Supabase se conectado
    try {
      await this.dataProvider.importTasks?.(news);
      await this.dataProvider.logImport?.("csv", this.csvPreview.length, news.length, dupes);
    } catch (_) {}

    CSVHandler.cancelPreview();
    this.renderAll();
    this.updateNavBadge();
    this.updateIntegKpis();
  }

  // API (simulada)
  async testApi() {
    const url = document.getElementById("api-url").value;
    const key = document.getElementById("api-key").value;
    if (!url) { showAlert("api-alert", "Informe a URL base da API.", "error"); return; }
    document.getElementById("btn-test-api").textContent = "⏳ Testando...";
    await sleep(1200);
    document.getElementById("btn-test-api").textContent = "🔌 Testar Conexão";
    if (key.length > 5) {
      showAlert("api-alert", "✓ Conexão simulada com sucesso! Quando tiver a chave real, ela será usada aqui.", "success");
      document.getElementById("btn-sync").style.background = "var(--green)";
      document.getElementById("btn-sync").style.color = "#fff";
    } else {
      showAlert("api-alert", "API Key muito curta. Insira a chave fornecida pelo time de produto.", "error");
    }
  }

  async syncNow() {
    showAlert("api-alert", "Sincronizando...", "info");
    await sleep(1500);
    const mockTickets = [
      { id: 999001, ticketOrc: "ELAW-156116", horasDev: 0, horasQa: 0, tipo: "NOVA FEATURE", classif: "Evolução", modulo: "Geral", cliente: "SCANIA LATIN AMERICA", desc: "NOVA FEATURE - Integração SCANIA", release: "7.16.0", prioridade: "Alta", status: "Planejado", dev: "Alexandre", demandante: "Time Produto", dataReg: new Date().toLocaleDateString("pt-BR"), origem: "api", origemId: "ELAW-156116" },
      { id: 999002, ticketOrc: "ELAW-156115", horasDev: 0, horasQa: 0, tipo: "NOVA FEATURE", classif: "Evolução", modulo: "Geral", cliente: "ELAW INTERNO",       desc: "NOVA FEATURE - Melhoria de interface",  release: "7.16.0", prioridade: "Média", status: "Planejado", dev: "Bruno",     demandante: "Time Produto", dataReg: new Date().toLocaleDateString("pt-BR"), origem: "api", origemId: "ELAW-156115" },
    ];
    const existingIds = new Set(this.tasks.map((t) => t.origemId || String(t.id)));
    const news  = mockTickets.filter((t) => !existingIds.has(t.origemId));
    const dupes = mockTickets.length - news.length;
    this.tasks.push(...news);
    this.addLog("api", mockTickets.length, news.length, dupes);
    try {
      await this.dataProvider.importTasks?.(news);
      await this.dataProvider.logImport?.("api", mockTickets.length, news.length, dupes);
    } catch (_) {}
    showAlert("api-alert", `✓ Sincronizado: ${news.length} novo(s), ${dupes} já existente(s).`, "success");
    this.renderAll();
    this.updateNavBadge();
    this.updateIntegKpis();
  }

  togglePolling() {
    this.pollingOn = !this.pollingOn;
    const toggle   = document.getElementById("polling-toggle");
    if (toggle) toggle.classList.toggle("on", this.pollingOn);
    const interval = parseInt(document.getElementById("poll-interval")?.value) || 15;
    const label    = document.getElementById("polling-label");
    if (label) label.textContent = this.pollingOn
      ? `Polling automático (a cada ${interval} min)`
      : "Polling automático (desativado)";
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.pollingOn)
      this.pollingTimer = setInterval(() => this.syncNow(), interval * 60000);
  }

  addLog(type, total, added, dupes) {
    this.importLog.unshift({ ts: new Date().toLocaleTimeString("pt-BR"), type, total, added, dupes });
    this.importLog = this.importLog.slice(0, 20);
    this.renderLog();
  }

  renderLog() {
    const el = document.getElementById("import-log");
    if (!el) return;
    if (!this.importLog.length) {
      el.innerHTML = "<p style='color:var(--muted);font-size:13px;text-align:center;padding:30px 0'>Nenhuma importação realizada ainda nesta sessão.</p>";
      return;
    }
    el.innerHTML = this.importLog.map((l) => `
      <div class="log-item">
        <span style="font-size:20px">${l.type === "csv" ? "📄" : "🔌"}</span>
        <div style="flex:1">
          <p style="font-size:13px;font-weight:600;margin-bottom:2px">${l.type === "csv" ? "Importação CSV" : "Sincronização API"}</p>
          <p style="font-size:12px;color:var(--muted)">${l.total} ticket(s) processados · <span style="color:var(--green)">${l.added} adicionados</span> · <span style="color:var(--yellow)">${l.dupes} duplicatas ignoradas</span></p>
        </div>
        <span style="font-size:11px;color:var(--dim);white-space:nowrap">${l.ts}</span>
      </div>`).join("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTENTICAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  async handleLogin(username, password) {
    const user = await this.dataProvider.validateUserCredentials(username, password);
    if (!user) {
      const errEl = document.getElementById("login-error");
      if (errEl) { errEl.textContent = "Usuário ou senha incorretos."; errEl.style.display = "block"; }
      return false;
    }

    this.currentUser     = user;
    this.isAuthenticated = true;

    // Exibir interface principal
    document.getElementById("view-login").classList.remove("active");
    document.getElementById("topbar").style.display    = "flex";
    document.getElementById("filterbar").style.display = "flex";
    document.getElementById("content").style.display   = "flex";

    const titleEl = document.getElementById("homepage-title");
    if (titleEl) titleEl.textContent = `Bem-vindo, ${user.name}!`;

    this.populateSelects();
    this.switchView("homepage");

    console.log(`✓ Usuário ${user.name} autenticado.`);
    return true;
  }

  logout() {
    this.currentUser     = null;
    this.isAuthenticated = false;

    document.getElementById("view-login").classList.add("active");
    document.getElementById("login-form").reset();
    const errEl = document.getElementById("login-error");
    if (errEl) errEl.style.display = "none";
    document.getElementById("topbar").style.display    = "none";
    document.getElementById("filterbar").style.display = "none";
    document.getElementById("content").style.display   = "none";

    const userInput = document.getElementById("login-user");
    if (userInput) userInput.focus();
    console.log("✓ Logout realizado.");
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES GLOBAIS (chamadas via atributos onclick no HTML)
// ═══════════════════════════════════════════════════════════════════════════

window.openModal     = (t)  => window.app.openModal(t);
window.closeModal    = ()   => window.app.closeModal();
window.saveTask      = ()   => window.app.saveTask();
window.deleteTask    = ()   => window.app.deleteTask();
window.updateTotal   = ()   => window.app.updateTotal();
window.togglePolling = ()   => window.app.togglePolling();
window.cancelPreview = ()   => CSVHandler.cancelPreview();
window.handleLogin   = async (event) => {
  event.preventDefault();
  const username = document.getElementById("login-user").value;
  const password = document.getElementById("login-pass").value;
  await window.app.handleLogin(username, password);
};


// ═══════════════════════════════════════════════════════════════════════════
// BOOTSTRAP — inicializa a aplicação ao carregar a página
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  const dataProvider = new SupabaseDataProvider(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.app = new DevTrackApp(dataProvider, DEVTRACK_CONFIG);
  await window.app.init();
});
