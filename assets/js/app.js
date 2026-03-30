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
    this.currentHomepageFilter   = "Em Andamento";
    this.homepageReleaseIds      = [];
    this.homepageReleaseStatuses = [];
    this._openHpPanel            = null;
    this._hpListenerReady        = false;

    // Estado dos filtros multi-select da filterbar
    this.filterSelections        = { status: [], dev: [], release: [], rstatus: [], tipo: [] };
    this._openFbPanel            = null;
    this._fbListenerReady        = false;
    this._fbDropdownsInitialized = false;
    this.backlogCollapsed      = new Set();
    this.currentReleaseView    = "cards";

    this._editingReleaseId     = null;
    this.releaseKpiFilter      = null;
    this.developers            = [];
    this._editingDevName       = null;
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

      // Carregar desenvolvedores do provider (fallback para config.DEVELOPERS)
      const devs = await this.dataProvider.getDevelopers?.();
      this.developers = (devs && devs.length) ? devs : (this.config.DEVELOPERS ? JSON.parse(JSON.stringify(this.config.DEVELOPERS)) : []);
      this._syncDevConfig();

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

    this._initFilterbarDropdowns();
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
    document.getElementById("btn-logout")?.addEventListener("click", () => this.logout());

    // Busca
    document.getElementById("search")?.addEventListener("input", () => this.renderAll());

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

    // Release
    document.getElementById("btn-new-release")?.addEventListener("click", () => this.openNewRelease());
    document.getElementById("r-inicio")?.addEventListener("input",   () => this._updateReleaseCapacityInfo());
    document.getElementById("r-fim")?.addEventListener("input",     () => this._updateReleaseCapacityInfo());
    document.getElementById("r-produto")?.addEventListener("change", () => this._updateReleaseCapacityInfo());

    // Desenvolvedores
    document.getElementById("btn-new-dev")?.addEventListener("click", () => this.openNewDevModal());
    document.getElementById("dev-mgmt-body")?.addEventListener("click", (e) => {
      if (e.target.matches("button.dev-edit"))   this.openEditDev(e.target.dataset.devname);
      if (e.target.matches("button.dev-delete")) this.removeDev(e.target.dataset.devname);
    });

    // User modal — show/hide menus section on role change
    document.getElementById("u-role")?.addEventListener("change", () => this._toggleUserMenusSection());

    // Modal — fechar ao clicar fora
    document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    // Modal de detalhe de release — fechar ao clicar fora
    document.getElementById("rel-detail-overlay")?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAVEGAÇÃO DE VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  switchView(v) {
    if (!this._canAccessView(v)) return;
    this.currentView = v;
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v)
    );
    document.querySelectorAll(".view").forEach((el) =>
      el.classList.toggle("active", el.id === "view-" + v)
    );
    document.getElementById("filterbar").style.display =
      ["integrations", "homepage", "users", "release", "developers"].includes(v) ? "none" : "";

    if (v === "integrations") this.updateIntegKpis();
    if (v === "homepage")     { this.currentHomepageFilter = this.currentHomepageFilter || "Em Andamento"; this.renderHomepage(); }
    if (v === "users")        this.renderUsers();
    if (v === "release")      this.renderRelease();
    if (v === "developers")   this.renderDevelopers();
    this.renderAll();
  }

  _canAccessView(view) {
    if (!this.currentUser) return false;
    const role  = this.currentUser.role;
    const menus = this.currentUser.menus || [];
    if (view === "homepage" || view === "kanban") return true;
    if (role === "admin") return true;
    if (view === "users") return false;
    return menus.includes(view);
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

  /**
   * Inicializa os dropdowns multi-select da filterbar global.
   * Chamado uma única vez após login (via populateSelects).
   */
  _initFilterbarDropdowns() {
    if (this._fbDropdownsInitialized) return;
    this._fbDropdownsInitialized = true;

    // Listener global close-outside (adicionado uma vez)
    if (!this._fbListenerReady) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".fb-dropdown")) {
          document.querySelectorAll(".fb-dropdown .hp-dropdown-panel.open").forEach((p) => p.classList.remove("open"));
          this._openFbPanel = null;
        }
      });
      this._fbListenerReady = true;
    }

    const filterDefs = [
      { key: "status",  panelId: "fb-status-panel",  btnId: "fb-status-btn",  lblId: "fb-status-lbl",  defaultLabel: "Todos os status",   options: this.config.STATUS_LIST },
      { key: "dev",     panelId: "fb-dev-panel",     btnId: "fb-dev-btn",     lblId: "fb-dev-lbl",     defaultLabel: "Todos os devs",     options: this.config.DEVS },
      { key: "release", panelId: "fb-release-panel", btnId: "fb-release-btn", lblId: "fb-release-lbl", defaultLabel: "Todas as releases", options: this.config.RELEASES.map((r) => r.id) },
      { key: "tipo",    panelId: "fb-tipo-panel",    btnId: "fb-tipo-btn",    lblId: "fb-tipo-lbl",    defaultLabel: "Todos os tipos",    options: this.config.TIPOS },
      { key: "rstatus", panelId: "fb-rstatus-panel", btnId: "fb-rstatus-btn", lblId: "fb-rstatus-lbl", defaultLabel: "Status da release", options: [...new Set(this.config.RELEASES.map((r) => r.status))] },
    ];

    filterDefs.forEach(({ key, panelId, btnId, lblId, defaultLabel, options }) => {
      const panel = document.getElementById(panelId);
      const btn   = document.getElementById(btnId);
      if (!panel || !btn) return;

      // Popula checkboxes
      panel.innerHTML = options.map((opt) => `
        <label class="hp-check-item">
          <input type="checkbox" value="${opt}"> ${opt}
        </label>`).join("");

      // Toggle painel
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.contains("open");
        document.querySelectorAll(".fb-dropdown .hp-dropdown-panel").forEach((p) => p.classList.remove("open"));
        this._openFbPanel = null;
        if (!isOpen) { panel.classList.add("open"); this._openFbPanel = panelId; }
      });

      // Mudança nos checkboxes
      panel.addEventListener("change", () => {
        const sel = [...panel.querySelectorAll("input:checked")].map((c) => c.value);
        this.filterSelections[key] = sel;
        document.getElementById(lblId).textContent =
          sel.length === 0   ? defaultLabel :
          sel.length <= 2    ? sel.join(", ") :
          `${sel.length} selecionados`;
        btn.classList.toggle("active", sel.length > 0);
        this._updateFbClearBtn();
        this.renderAll();
      });
    });

    // Botão Limpar
    document.getElementById("fb-clear")?.addEventListener("click", () => {
      this.filterSelections = { status: [], dev: [], release: [], rstatus: [], tipo: [] };
      filterDefs.forEach(({ panelId, btnId, lblId, defaultLabel }) => {
        document.querySelectorAll(`#${panelId} input`).forEach((cb) => cb.checked = false);
        document.getElementById(lblId).textContent = defaultLabel;
        document.getElementById(btnId).classList.remove("active");
      });
      this._updateFbClearBtn();
      this.renderAll();
    });

    this._updateFbClearBtn();
  }

  _updateFbClearBtn() {
    const hasFilter = Object.values(this.filterSelections).some((arr) => arr.length > 0);
    const btn = document.getElementById("fb-clear");
    if (btn) btn.disabled = !hasFilter;
  }

  getFiltered() {
    const q = document.getElementById("search")?.value?.toLowerCase() || "";
    const { status, dev, release, rstatus, tipo } = this.filterSelections;

    // IDs de release que correspondem aos status de release selecionados
    const releaseIdsByStatus = rstatus.length
      ? new Set((this.config.RELEASES || []).filter((r) => rstatus.includes(r.status)).map((r) => r.id))
      : null;

    return this.tasks.filter((t) => {
      if (q              && !t.desc.toLowerCase().includes(q) && !t.cliente.toLowerCase().includes(q) && !String(t.id).includes(q)) return false;
      if (status.length  && !status.includes(t.status))           return false;
      if (dev.length     && !dev.includes(t.dev))                 return false;
      if (release.length && !release.includes(t.release))         return false;
      if (releaseIdsByStatus && !releaseIdsByStatus.has(t.release)) return false;
      if (tipo.length    && !tipo.includes(t.tipo))               return false;
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

    if (this.currentView === "homepage")    this.renderHomepage();
    if (this.currentView === "users")       this.renderUsers();
    if (this.currentView === "kanban")      this.renderKanban(filtered);
    if (this.currentView === "backlog")     this.renderBacklog(filtered);
    if (this.currentView === "dashboard")   this.renderDashboard(filtered);
    if (this.currentView === "release")     this.renderRelease();
    if (this.currentView === "developers")  this.renderDevelopers();
  }

  renderKanban(filtered)    { UIComponents.renderKanban(filtered, this.config); }
  renderBacklog(filtered) {
    UIComponents.renderBacklog(filtered, this.config, this.sortCol, this.sortDir, this.backlogCollapsed, (id) => {
      if (this.backlogCollapsed.has(id)) this.backlogCollapsed.delete(id);
      else this.backlogCollapsed.add(id);
      this.renderAll();
    });
  }
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

  _renderHomepageFilters() {
    const container = document.getElementById("homepage-filters");
    if (!container) return;

    // Listener global de click-outside (adicionado uma única vez)
    if (!this._hpListenerReady) {
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".hp-dropdown")) {
          document.querySelectorAll(".hp-dropdown-panel.open").forEach((p) => p.classList.remove("open"));
          this._openHpPanel = null;
        }
      });
      this._hpListenerReady = true;
    }

    const releases       = this.config.RELEASES || [];
    const releaseIds     = releases.map((r) => r.id);
    const releaseStatuses = [...new Set(releases.map((r) => r.status))];
    const selIds = this.homepageReleaseIds;
    const selSts = this.homepageReleaseStatuses;
    const hasFilter = selIds.length > 0 || selSts.length > 0;

    const labelIds = selIds.length === 0 ? "Todas as releases"
      : selIds.length <= 2 ? selIds.join(", ")
      : `${selIds.length} selecionadas`;
    const labelSts = selSts.length === 0 ? "Todos os status"
      : selSts.length <= 2 ? selSts.join(", ")
      : `${selSts.length} selecionados`;

    container.innerHTML = `
      <div class="hp-filters">
        <div class="hp-filter-group">
          <span class="hp-filter-label">ID da Release</span>
          <div class="hp-dropdown" id="hpd-release">
            <button class="hp-dropdown-btn${selIds.length ? " active" : ""}" id="hpd-release-btn">
              <span>${labelIds}</span><span class="hp-arrow">▾</span>
            </button>
            <div class="hp-dropdown-panel" id="hpd-release-panel">
              ${releaseIds.map((id) => `
                <label class="hp-check-item">
                  <input type="checkbox" value="${id}"${selIds.includes(id) ? " checked" : ""}> ${id}
                </label>`).join("")}
            </div>
          </div>
        </div>
        <div class="hp-filter-group">
          <span class="hp-filter-label">Status da Release</span>
          <div class="hp-dropdown" id="hpd-rstatus">
            <button class="hp-dropdown-btn${selSts.length ? " active" : ""}" id="hpd-rstatus-btn">
              <span>${labelSts}</span><span class="hp-arrow">▾</span>
            </button>
            <div class="hp-dropdown-panel" id="hpd-rstatus-panel">
              ${releaseStatuses.map((st) => `
                <label class="hp-check-item">
                  <input type="checkbox" value="${st}"${selSts.includes(st) ? " checked" : ""}> ${st}
                </label>`).join("")}
            </div>
          </div>
        </div>
        <button class="hp-clear-btn btn btn-secondary" id="hpf-clear"${!hasFilter ? " disabled" : ""}>
          Limpar Filtros
        </button>
      </div>`;

    // Restaura painel aberto após re-render
    if (this._openHpPanel) {
      const panel = document.getElementById(this._openHpPanel);
      if (panel) panel.classList.add("open");
    }

    // Toggle painel Release ID
    document.getElementById("hpd-release-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = document.getElementById("hpd-release-panel");
      const isOpen = panel.classList.contains("open");
      document.querySelectorAll(".hp-dropdown-panel").forEach((p) => p.classList.remove("open"));
      this._openHpPanel = null;
      if (!isOpen) { panel.classList.add("open"); this._openHpPanel = "hpd-release-panel"; }
    });

    // Toggle painel Status da Release
    document.getElementById("hpd-rstatus-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = document.getElementById("hpd-rstatus-panel");
      const isOpen = panel.classList.contains("open");
      document.querySelectorAll(".hp-dropdown-panel").forEach((p) => p.classList.remove("open"));
      this._openHpPanel = null;
      if (!isOpen) { panel.classList.add("open"); this._openHpPanel = "hpd-rstatus-panel"; }
    });

    // Checkbox — Release IDs
    document.querySelectorAll("#hpd-release-panel input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        this.homepageReleaseIds = [...document.querySelectorAll("#hpd-release-panel input:checked")].map((c) => c.value);
        this._openHpPanel = "hpd-release-panel";
        this.renderHomepage();
      });
    });

    // Checkbox — Status da Release
    document.querySelectorAll("#hpd-rstatus-panel input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        this.homepageReleaseStatuses = [...document.querySelectorAll("#hpd-rstatus-panel input:checked")].map((c) => c.value);
        this._openHpPanel = "hpd-rstatus-panel";
        this.renderHomepage();
      });
    });

    // Botão Limpar
    document.getElementById("hpf-clear").addEventListener("click", () => {
      this.homepageReleaseIds      = [];
      this.homepageReleaseStatuses = [];
      this._openHpPanel            = null;
      this.renderHomepage();
    });
  }

  renderHomepage() {
    if (!this.currentUser) return;
    const userTasks = this.getTasksForUser(this.currentUser);

    // Render barra de filtros de release
    this._renderHomepageFilters();

    // Aplica filtros de release (combinável)
    let baseUserTasks = userTasks;
    if (this.homepageReleaseIds.length) {
      baseUserTasks = baseUserTasks.filter((t) => this.homepageReleaseIds.includes(t.release));
    }
    if (this.homepageReleaseStatuses.length) {
      const relIds = (this.config.RELEASES || [])
        .filter((r) => this.homepageReleaseStatuses.includes(r.status))
        .map((r) => r.id);
      baseUserTasks = baseUserTasks.filter((t) => relIds.includes(t.release));
    }

    const stats     = getStats(baseUserTasks);

    // Contagens específicas por card
    const myTasksCount   = baseUserTasks.filter((t) => t.status !== "Concluído" && t.status !== "Bloqueado").length;
    const inProgCount    = baseUserTasks.filter((t) => t.status === "Em Desenvolvimento" || t.status === "Planejado").length;
    const homologCount   = baseUserTasks.filter((t) => t.status === "Em Homologação - QA" || t.status === "Em Homologação - Cliente").length;

    // KPIs clicáveis — ordem: Minhas Tarefas → Em Andamento → Em Homologação → Bloqueadas
    const cards = [
      { label: "Minhas Tarefas",  value: myTasksCount,  color: "var(--text)",    sub: `${stats.totalHours}h estimadas` },
      { label: "Em Andamento",    value: inProgCount,   color: "var(--accent)",  sub: "Desenvolvimento e Planejado" },
      { label: "Em Homologação",  value: homologCount,  color: "var(--yellow)",  sub: "QA e Cliente" },
      { label: "Bloqueadas",      value: stats.blocked, color: "var(--red)",     sub: "Requer atenção" },
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
      "Em Andamento":   ["Em Desenvolvimento", "Planejado"],
      "Em Homologação": ["Em Homologação - QA", "Em Homologação - Cliente"],
      "Bloqueadas":     ["Bloqueado"],
    };
    let filteredTasks;
    if (this.currentHomepageFilter === "Minhas Tarefas") {
      filteredTasks = baseUserTasks.filter((t) => t.status !== "Concluído" && t.status !== "Bloqueado");
    } else {
      const requiredStatuses = statusMap[this.currentHomepageFilter];
      filteredTasks = requiredStatuses
        ? baseUserTasks.filter((t) => requiredStatuses.includes(t.status))
        : baseUserTasks;
    }

    // Barras de status
    document.getElementById("homepage-status-bars").innerHTML =
      this.config.STATUS_LIST.map((s) => {
        const n   = baseUserTasks.filter((t) => t.status === s).length;
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
    const roleLabel = { admin: "Administrador", developer: "Desenvolvedor", products: "Produtos" };
    tbody.innerHTML = (this.users || []).map((u) => {
      const menus   = u.role === "admin" ? "Todos" : (u.menus || []).join(", ") || "—";
      const roleBadgeColor = u.role === "admin" ? "var(--accent)" : u.role === "products" ? "#f59e0b" : "var(--green)";
      return `<tr>
        <td style="font-family:monospace">${u.username || u.name}</td>
        <td>${u.name || "-"}</td>
        <td><span class="badge" style="background:${roleBadgeColor}18;color:${roleBadgeColor};border:1px solid ${roleBadgeColor}44">${roleLabel[u.role] || u.role}</span></td>
        <td style="font-size:11px;color:var(--muted)">${menus}</td>
        <td>${u.active === false ? '<span style="color:var(--red)">Inativo</span>' : '<span style="color:var(--green)">Ativo</span>'}</td>
        <td>
          <button class="rel-action-btn user-edit"   data-username="${u.username || u.name}" title="Editar">✏</button>
          <button class="rel-action-btn rel-action-delete user-delete" data-username="${u.username || u.name}" title="Excluir">🗑</button>
        </td>
      </tr>`;
    }).join("");
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
    ["modal-task-content", "modal-release-content", "modal-user-content", "modal-dev-content"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("active", "block");
      el.style.display = "none";
    });

    const target = document.getElementById(
      mode === "task"      ? "modal-task-content"    :
      mode === "release"   ? "modal-release-content" :
      mode === "developer" ? "modal-dev-content"     :
      "modal-user-content"
    );
    if (target) {
      target.style.display = "";
      target.classList.add("active");
      if (mode !== "task") target.classList.add("block");
    }

    const btnDelete = document.getElementById("btn-delete");
    if (btnDelete) btnDelete.style.display = mode === "task" ? "" : "none";

    // Garante permissão de edição de tarefa para perfil developer (só seus tickets)
    if (mode === "task" && this.currentUser?.role === "developer") {
      const isOwner = this.currentTask?.dev === this.currentUser.name || this.currentTask?.dev === this.currentUser.username;
      if (btnDelete) btnDelete.style.display = isOwner ? "" : "none";
      document.getElementById("btn-save").disabled = !isOwner && !this.isNewTask;
    } else if (mode === "task") {
      document.getElementById("btn-save").disabled = false;
    }
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

  // ─────────────────────────────────────────────────────────────────────────
  // DESENVOLVEDORES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sincroniza DEVS e DEV_HORAS em config a partir de this.developers
   * (DEV_HORAS usa Enterprise×20 como proxy de horas mensais)
   */
  _syncDevConfig() {
    this.config.DEVS     = this.developers.filter((d) => d.active !== false).map((d) => d.name);
    this.config.DEV_HORAS = {};
    this.developers.forEach((d) => {
      // horas mensais ≈ horas/dia × 20 dias úteis (usado como fallback legado)
      this.config.DEV_HORAS[d.name] = Math.round(((d.Enterprise || 0) + (d.CLM || 0) + (d.ElawOn || 0)) * 20);
    });
    // Atualiza DEVELOPERS em config também
    this.config.DEVELOPERS = this.developers;
  }

  /**
   * Retorna capacidade do dev em horas para uma release específica (por produto)
   * bizDays: dias úteis da release
   * produto: "Enterprise" | "CLM" | "ElawOn"
   */
  _devCapacityForRelease(devName, bizDays, produto) {
    const dev = this.developers.find((d) => d.name === devName);
    if (!dev || !bizDays) return 0;
    const hPerDay = dev[produto] || 0;
    return Math.round(hPerDay * bizDays);
  }

  /**
   * Oculta menus que o usuário não tem permissão de ver
   */
  _applyMenuVisibility() {
    const user  = this.currentUser;
    if (!user) return;
    const role  = user.role;
    const menus = user.menus || [];

    document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
      const view = btn.dataset.view;
      if (view === "homepage" || view === "kanban") { btn.style.display = ""; return; }
      if (role === "admin") { btn.style.display = ""; return; }
      if (view === "users") { btn.style.display = "none"; return; }
      btn.style.display = menus.includes(view) ? "" : "none";
    });

    // Botão Nova Tarefa — visível para todos exceto perfil products (somente pode alocar release)
    const btnNew = document.getElementById("btn-new");
    if (btnNew) btnNew.style.display = role === "products" ? "none" : "";
  }

  renderDevelopers() {
    // Tabela de gestão
    const tbody = document.getElementById("dev-mgmt-body");
    if (tbody) {
      tbody.innerHTML = this.developers.map((d) => {
        const capMes = Math.round(((d.Enterprise || 0) + (d.CLM || 0) + (d.ElawOn || 0)) * 20);
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:8px">${avatarHTML(d.name, 26)}<span style="font-weight:600">${d.name}</span></div></td>
          <td style="text-align:center;font-family:monospace;color:var(--accent)">${d.Enterprise || 0}h</td>
          <td style="text-align:center;font-family:monospace;color:#f59e0b">${d.CLM || 0}h</td>
          <td style="text-align:center;font-family:monospace;color:#a78bfa">${d.ElawOn || 0}h</td>
          <td style="text-align:center;font-family:monospace">${capMes}h</td>
          <td>${d.active === false ? '<span style="color:var(--red)">Inativo</span>' : '<span style="color:var(--green)">Ativo</span>'}</td>
          <td>
            <button class="rel-action-btn dev-edit" data-devname="${d.name}" title="Editar">✏</button>
            <button class="rel-action-btn rel-action-delete dev-delete" data-devname="${d.name}" title="Excluir">🗑</button>
          </td>
        </tr>`;
      }).join("") || `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Nenhum desenvolvedor cadastrado.</td></tr>`;
    }

    // Visão de alocação por release
    const allocEl = document.getElementById("dev-alloc-content");
    if (!allocEl) return;

    const releases = this.config.RELEASES.filter((r) => r.status !== "Concluído");
    if (!releases.length) {
      allocEl.innerHTML = `<p style="color:var(--muted);text-align:center;padding:24px">Nenhuma release ativa ou planejada.</p>`;
      return;
    }

    allocEl.innerHTML = releases.map((rel) => {
      const bizDays   = (rel.dataInicio && rel.dataFim) ? businessDays(rel.dataInicio, rel.dataFim) : 0;
      const rc        = rel.status === "Em Andamento" ? "var(--accent)" : "#64748b";
      const relTasks  = this.tasks.filter((t) => t.release === rel.id);

      const devRows = this.developers.filter((d) => d.active !== false).map((d) => {
        const cap       = this._devCapacityForRelease(d.name, bizDays, rel.produto);
        const allocated = relTasks.filter((t) => t.dev === d.name).reduce((a, t) => a + (t.horasDev || 0) + (t.horasQa || 0), 0);
        const pct       = cap ? Math.min(100, Math.round((allocated / cap) * 100)) : 0;
        const pctColor  = pct > 100 ? "var(--red)" : pct > 85 ? "var(--yellow)" : pct > 0 ? "var(--green)" : "var(--dim)";
        const capLabel  = cap ? `${allocated}h / ${cap}h` : `${allocated}h / sem cap.`;
        return `<div class="dev-alloc-row">
          <div class="dev-alloc-info">
            ${avatarHTML(d.name, 24)}
            <span style="font-size:12px;font-weight:600;min-width:80px">${d.name}</span>
          </div>
          <div class="dev-alloc-bar-wrap">
            <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${pct}%;background:${pctColor}"></div></div>
            <span style="font-size:11px;font-weight:700;color:${pctColor};min-width:90px;text-align:right">${capLabel}</span>
          </div>
          ${pct > 100 ? `<span style="font-size:10px;color:var(--red);white-space:nowrap">🔴 +${allocated - cap}h</span>` : ""}
        </div>`;
      }).join("");

      return `<div class="dev-alloc-release" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <span style="font-weight:800;font-size:14px;color:${rc}">${rel.id}</span>
          <span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${rel.status}</span>
          <span style="font-size:12px;color:var(--muted)">${rel.produto} · ${rel.dataInicio || "?"} → ${rel.dataFim}${bizDays ? ` · ${bizDays} dias úteis` : ""}</span>
        </div>
        ${devRows}
      </div>`;
    }).join("");
  }

  openNewDevModal() {
    this._editingDevName = null;
    this._setModalMode("developer");
    document.getElementById("modal-id").textContent           = "#Novo Desenvolvedor";
    document.getElementById("modal-tipo-badge").textContent   = "Desenvolvedor";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("d-name").value       = "";
    document.getElementById("d-enterprise").value = "";
    document.getElementById("d-clm").value        = "";
    document.getElementById("d-elawon").value     = "";
    document.getElementById("d-active").value     = "true";
    document.getElementById("btn-save").textContent = "✚ Criar Desenvolvedor";
    document.getElementById("modal-overlay").classList.add("open");
  }

  openEditDev(devName) {
    const dev = this.developers.find((d) => d.name === devName);
    if (!dev) return;
    this._editingDevName = devName;
    this._setModalMode("developer");
    document.getElementById("modal-id").textContent           = "#Editar Desenvolvedor";
    document.getElementById("modal-tipo-badge").textContent   = "Desenvolvedor";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("d-name").value       = dev.name;
    document.getElementById("d-enterprise").value = dev.Enterprise || 0;
    document.getElementById("d-clm").value        = dev.CLM || 0;
    document.getElementById("d-elawon").value     = dev.ElawOn || 0;
    document.getElementById("d-active").value     = dev.active === false ? "false" : "true";
    document.getElementById("btn-save").textContent = "Salvar Desenvolvedor";
    document.getElementById("modal-overlay").classList.add("open");
  }

  async removeDev(devName) {
    if (!confirm(`Excluir o desenvolvedor ${devName}?`)) return;
    try { await this.dataProvider.deleteDeveloper?.(devName); } catch (e) { console.warn("deleteDeveloper:", e.message); }
    this.developers = this.developers.filter((d) => d.name !== devName);
    this._syncDevConfig();
    this.populateSelects();
    this.renderDevelopers();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELEASE — Menu gerencial
  // ─────────────────────────────────────────────────────────────────────────

  renderRelease() {
    const releases   = this.config.RELEASES;
    const tasks      = this.tasks;
    const today      = new Date(); today.setHours(0, 0, 0, 0);

    // KPI cards clicáveis (filtram a listagem)
    const ativasCount = releases.filter((r) => r.status === "Em Andamento" || r.status === "Planejado").length;
    document.getElementById("release-kpi-grid").innerHTML = [
      { key: "Ativas",       value: ativasCount,                                                    color: "var(--accent)", sub: "Em And. + Planejadas" },
      { key: "Em Andamento", value: releases.filter((r) => r.status === "Em Andamento").length,     color: "var(--accent)", sub: "em desenvolvimento"   },
      { key: "Planejadas",   value: releases.filter((r) => r.status === "Planejado").length,        color: "#64748b",       sub: "aguardando início"    },
      { key: "Concluídas",   value: releases.filter((r) => r.status === "Concluído").length,        color: "var(--green)",  sub: "entregues"            },
    ].map((k) =>
      `<div class="kpi-card homepage-filter${this.releaseKpiFilter === k.key ? " active" : ""}" data-kpi-key="${k.key}">
        <div class="kpi-label">${k.key}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`
    ).join("");

    // Toggle views
    document.getElementById("rel-view-cards").classList.toggle("active", this.currentReleaseView === "cards");
    document.getElementById("rel-view-table").classList.toggle("active", this.currentReleaseView === "table");
    document.getElementById("release-cards-wrap").style.display = this.currentReleaseView === "cards" ? "" : "none";
    document.getElementById("release-table-wrap").style.display = this.currentReleaseView === "table" ? "" : "none";

    // Filtra releases pelo KPI selecionado
    const kpiFilterMap = {
      "Ativas":       (r) => r.status === "Em Andamento" || r.status === "Planejado",
      "Em Andamento": (r) => r.status === "Em Andamento",
      "Planejadas":   (r) => r.status === "Planejado",
      "Concluídas":   (r) => r.status === "Concluído",
    };
    const visibleReleases = this.releaseKpiFilter ? releases.filter(kpiFilterMap[this.releaseKpiFilter]) : releases;

    // Monta dados de cada release
    const releaseData = visibleReleases.map((rel) => {
      const relTasks  = tasks.filter((t) => t.release === rel.id);
      const totalDev  = relTasks.reduce((a, t) => a + (t.horasDev || 0), 0);
      const totalQa   = relTasks.reduce((a, t) => a + (t.horasQa  || 0), 0);
      const allocated = totalDev + totalQa;
      const done      = relTasks.filter((t) => t.status === "Concluído").length;
      const pctDone   = relTasks.length ? Math.round((done / relTasks.length) * 100) : 0;
      const bizDays   = (rel.dataInicio && rel.dataFim) ? businessDays(rel.dataInicio, rel.dataFim) : 0;
      // Capacidade global = soma de todos os devs para esse produto
      const globalCap = this.developers
        .filter((d) => d.active !== false)
        .reduce((sum, d) => sum + Math.round((d[rel.produto] || 0) * bizDays), 0);
      const pctAlloc  = globalCap ? Math.round((allocated / globalCap) * 100) : 0;

      // Capacidade e alocação por desenvolvedor
      const devBreakdown = {};
      this.developers.filter((d) => d.active !== false).forEach((devObj) => {
        const dev    = devObj.name;
        const devCap = this._devCapacityForRelease(dev, bizDays, rel.produto);
        const devTasks = relTasks.filter((t) => t.dev === dev);
        const dHdev    = devTasks.reduce((a, t) => a + (t.horasDev || 0), 0);
        const dHqa     = devTasks.reduce((a, t) => a + (t.horasQa  || 0), 0);
        if (devTasks.length > 0) {
          devBreakdown[dev] = {
            tasks: devTasks.length, horasDev: dHdev, horasQa: dHqa,
            capacity: devCap,
            pct: devCap ? Math.round(((dHdev + dHqa) / devCap) * 100) : 0,
          };
        }
      });

      const dataFimDate     = rel.dataFim ? (() => { const [d, m, y] = rel.dataFim.split("/").map(Number); return new Date(y, m - 1, d); })() : null;
      const isVencida       = dataFimDate && dataFimDate < today && rel.status !== "Concluído";
      const isSobrealocada  = globalCap > 0 && allocated > globalCap;
      const isSemTickets    = relTasks.length === 0;

      return { rel, relTasks, totalDev, totalQa, allocated, done, pctDone, bizDays, globalCap, pctAlloc, devBreakdown, isVencida, isSobrealocada, isSemTickets };
    });

    // ── Renderiza Cards ──
    document.getElementById("release-cards-wrap").innerHTML = releaseData.map((d) => {
      const { rel, relTasks, totalDev, totalQa, allocated, done, pctDone, bizDays, globalCap, pctAlloc, isVencida, isSobrealocada, isSemTickets } = d;
      const rc         = rel.status === "Concluído" ? "var(--green)" : rel.status === "Em Andamento" ? "var(--accent)" : "#64748b";
      const allocColor = pctAlloc > 100 ? "var(--red)" : pctAlloc > 85 ? "var(--yellow)" : "var(--green)";
      const doneColor  = pctDone === 100 ? "var(--green)" : pctDone > 50 ? "var(--accent)" : "var(--yellow)";
      const riskBadges = [
        isSobrealocada && `<span class="rel-risk-badge rel-risk-red">🔴 Sobrealocada</span>`,
        isVencida      && `<span class="rel-risk-badge rel-risk-yellow">⚠ Vencida</span>`,
        isSemTickets   && `<span class="rel-risk-badge rel-risk-gray">🟡 Sem tickets</span>`,
      ].filter(Boolean).join("");

      return `<div class="rel-card" data-release-id="${rel.id}">
        <div class="rel-card-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
            <span class="rel-card-id" style="color:${rc}">${rel.id}</span>
            <span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${rel.status}</span>
            ${riskBadges}
          </div>
          <div class="rel-card-actions" onclick="event.stopPropagation()">
            <button class="rel-action-btn" data-action="edit"   data-rid="${rel.id}" title="Editar">✏</button>
            <button class="rel-action-btn rel-action-delete" data-action="delete" data-rid="${rel.id}" title="Excluir">🗑</button>
          </div>
        </div>
        <div class="rel-card-meta">${rel.produto} · ${rel.dataInicio || "—"} → ${rel.dataFim}${bizDays ? ` · ${bizDays} dias úteis` : ""}</div>
        <div class="rel-card-metrics">
          <div class="rel-metric"><span class="rel-metric-label">Capacidade</span><span class="rel-metric-value">${globalCap}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">H.Dev</span><span class="rel-metric-value" style="color:var(--accent)">${totalDev}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">H.QA</span><span class="rel-metric-value" style="color:#f59e0b">${totalQa}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">Tickets</span><span class="rel-metric-value">${relTasks.length}</span></div>
        </div>
        <div class="rel-progress-row">
          <span class="rel-progress-label">Alocação</span>
          <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${Math.min(pctAlloc, 100)}%;background:${allocColor}"></div></div>
          <span style="font-size:11px;font-weight:700;color:${allocColor};min-width:56px;text-align:right">${allocated}h / ${globalCap}h</span>
        </div>
        <div class="rel-progress-row">
          <span class="rel-progress-label">Conclusão</span>
          <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${pctDone}%;background:${doneColor}"></div></div>
          <span style="font-size:11px;font-weight:700;color:${doneColor};min-width:56px;text-align:right">${done}/${relTasks.length} · ${pctDone}%</span>
        </div>
      </div>`;
    }).join("") || `<p style="color:var(--muted);text-align:center;padding:40px">Nenhuma release cadastrada.</p>`;

    // ── Renderiza Tabela ──
    document.getElementById("release-table-wrap").innerHTML = `
      <table class="rel-table">
        <thead><tr>
          <th>Release</th><th>Produto</th><th>Status</th><th>Período</th>
          <th>Dias Úteis</th><th>Capacidade</th><th>H.Dev</th><th>H.QA</th>
          <th>Tickets</th><th>Conclusão</th><th>Alocação</th><th>Alertas</th><th></th>
        </tr></thead>
        <tbody>${releaseData.map((d) => {
          const { rel, relTasks, totalDev, totalQa, pctDone, bizDays, globalCap, pctAlloc, isVencida, isSobrealocada, isSemTickets } = d;
          const rc         = rel.status === "Concluído" ? "var(--green)" : rel.status === "Em Andamento" ? "var(--accent)" : "#64748b";
          const allocColor = pctAlloc > 100 ? "var(--red)" : pctAlloc > 85 ? "var(--yellow)" : "var(--green)";
          const doneColor  = pctDone === 100 ? "var(--green)" : pctDone > 50 ? "var(--accent)" : "var(--yellow)";
          const alerts     = [isSobrealocada && "🔴", isVencida && "⚠", isSemTickets && "🟡"].filter(Boolean).join(" ") || "✅";
          return `<tr class="rel-table-row" data-release-id="${rel.id}">
            <td style="font-family:monospace;font-weight:700;color:${rc}">${rel.id}</td>
            <td>${rel.produto}</td>
            <td><span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${rel.status}</span></td>
            <td style="font-size:11px;color:var(--muted);white-space:nowrap">${rel.dataInicio || "—"} → ${rel.dataFim}</td>
            <td style="text-align:center">${bizDays || "—"}</td>
            <td style="text-align:right;font-family:monospace">${globalCap}h</td>
            <td style="text-align:right;font-family:monospace;color:var(--accent)">${totalDev}h</td>
            <td style="text-align:right;font-family:monospace;color:#f59e0b">${totalQa}h</td>
            <td style="text-align:center">${relTasks.length}</td>
            <td><div style="display:flex;align-items:center;gap:5px">
              <div class="prog-bar-bg" style="width:70px"><div class="prog-bar" style="width:${pctDone}%;background:${doneColor}"></div></div>
              <span style="font-size:11px;font-weight:700;color:${doneColor}">${pctDone}%</span>
            </div></td>
            <td><div style="display:flex;align-items:center;gap:5px">
              <div class="prog-bar-bg" style="width:70px"><div class="prog-bar" style="width:${Math.min(pctAlloc, 100)}%;background:${allocColor}"></div></div>
              <span style="font-size:11px;font-weight:700;color:${allocColor}">${pctAlloc}%</span>
            </div></td>
            <td style="font-size:13px">${alerts}</td>
            <td onclick="event.stopPropagation()"><div style="display:flex;gap:4px">
              <button class="rel-action-btn" data-action="edit"   data-rid="${rel.id}" title="Editar">✏</button>
              <button class="rel-action-btn rel-action-delete" data-action="delete" data-rid="${rel.id}" title="Excluir">🗑</button>
            </div></td>
          </tr>`;
        }).join("")}</tbody>
      </table>`;

    // Bind eventos de clique
    this._bindReleaseEvents(releaseData);
  }

  _bindReleaseEvents(releaseData) {
    // KPI cards — filtram a listagem
    document.querySelectorAll(".kpi-card[data-kpi-key]").forEach((card) => {
      card.addEventListener("click", () => {
        const k = card.dataset.kpiKey;
        this.releaseKpiFilter = this.releaseKpiFilter === k ? null : k;
        this.renderRelease();
      });
    });

    // Cards e linhas da tabela — abre modal de detalhe
    document.querySelectorAll(".rel-card, .rel-table-row").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.releaseId;
        const data = releaseData.find((d) => d.rel.id === id);
        if (data) this._openReleaseDetailModal(data);
      });
    });

    // Botões de ação (editar/excluir)
    document.querySelectorAll(".rel-action-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.dataset.action === "edit")   this.openEditRelease(btn.dataset.rid);
        if (btn.dataset.action === "delete") this.deleteRelease(btn.dataset.rid);
      });
    });

    // Toggle Cards / Tabela
    document.getElementById("rel-view-cards")?.addEventListener("click", () => {
      this.currentReleaseView = "cards"; this.renderRelease();
    });
    document.getElementById("rel-view-table")?.addEventListener("click", () => {
      this.currentReleaseView = "table"; this.renderRelease();
    });
  }

  _openReleaseDetailModal(data) {
    const { rel, relTasks, totalDev, totalQa, allocated, pctDone, bizDays, globalCap, pctAlloc, devBreakdown } = data;
    const rc         = rel.status === "Concluído" ? "var(--green)" : rel.status === "Em Andamento" ? "var(--accent)" : "#64748b";
    const allocColor = pctAlloc > 100 ? "var(--red)" : pctAlloc > 85 ? "var(--yellow)" : "var(--green)";
    const doneColor  = pctDone === 100 ? "var(--green)" : pctDone > 50 ? "var(--accent)" : "var(--yellow)";

    const devRows = Object.entries(devBreakdown)
      .sort((a, b) => b[1].horasDev - a[1].horasDev)
      .map(([dev, d]) => {
        const pctColor = d.pct > 100 ? "var(--red)" : d.pct > 85 ? "var(--yellow)" : "var(--green)";
        return `<div class="rel-dev-row">
          <div class="rel-dev-info">
            ${avatarHTML(dev, 26)}
            <div>
              <div style="font-size:12px;font-weight:700">${dev}</div>
              <div style="font-size:10px;color:var(--muted)">${d.tasks} tarefa${d.tasks !== 1 ? "s" : ""}</div>
            </div>
          </div>
          <div class="rel-dev-hours">
            <span style="color:var(--accent)">${d.horasDev}h dev</span>
            <span style="color:#f59e0b">${d.horasQa}h qa</span>
            ${d.capacity ? `<span style="color:var(--muted)">/ ${d.capacity}h cap</span>` : ""}
          </div>
          ${d.capacity ? `<div style="display:flex;align-items:center;gap:6px;margin-top:5px">
            <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${Math.min(d.pct, 100)}%;background:${pctColor}"></div></div>
            <span style="font-size:11px;font-weight:700;color:${pctColor};min-width:36px;text-align:right">${d.pct}%</span>
          </div>` : ""}
        </div>`;
      }).join("");

    const ticketRows = relTasks.map((t) => {
      const ss = this.config.STATUS_STYLE[t.status] || {};
      return `<div class="rel-ticket-row" data-task-id="${t.id}">
        <span style="font-family:monospace;font-size:10px;color:var(--dim);flex-shrink:0">#${t.id}</span>
        <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${t.desc}</span>
        <span class="badge" style="background:${ss.bg};color:${ss.color};border:1px solid ${ss.color}30;font-size:10px;white-space:nowrap;flex-shrink:0"><span class="badge-dot" style="background:${ss.dot}"></span>${t.status}</span>
        <span style="font-family:monospace;font-size:11px;color:var(--accent);flex-shrink:0">${t.horasDev}h</span>
      </div>`;
    }).join("");

    const overlay = document.getElementById("rel-detail-overlay");
    overlay.classList.add("open");
    document.getElementById("rel-detail-content").innerHTML = `
      <div class="rel-detail-header">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-size:17px;font-weight:800;color:${rc}">${rel.id}</span>
            <span class="backlog-release-badge" style="background:${rc}18;color:${rc};border:1px solid ${rc}44">${rel.status}</span>
          </div>
          <div style="font-size:11px;color:var(--muted)">${rel.produto} · ${rel.dataInicio || "—"} → ${rel.dataFim}${bizDays ? ` · ${bizDays} dias úteis` : ""}</div>
        </div>
        <button class="rel-action-btn" id="rel-detail-close" title="Fechar" style="flex-shrink:0">✕</button>
      </div>

      <div class="rel-detail-section">
        <div class="rel-detail-section-title">Capacidade × Alocação</div>
        <div class="rel-metrics-grid">
          <div class="rel-metric"><span class="rel-metric-label">Capacidade</span><span class="rel-metric-value">${globalCap}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">H.Dev</span><span class="rel-metric-value" style="color:var(--accent)">${totalDev}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">H.QA</span><span class="rel-metric-value" style="color:#f59e0b">${totalQa}h</span></div>
          <div class="rel-metric"><span class="rel-metric-label">Total Alocado</span><span class="rel-metric-value" style="color:${allocColor}">${allocated}h</span></div>
        </div>
        <div class="rel-progress-row" style="margin-top:10px">
          <span class="rel-progress-label">Alocação</span>
          <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${Math.min(pctAlloc, 100)}%;background:${allocColor}"></div></div>
          <span style="font-size:12px;font-weight:700;color:${allocColor};min-width:44px;text-align:right">${pctAlloc}%</span>
        </div>
        <div class="rel-progress-row">
          <span class="rel-progress-label">Conclusão</span>
          <div class="prog-bar-bg" style="flex:1"><div class="prog-bar" style="width:${pctDone}%;background:${doneColor}"></div></div>
          <span style="font-size:12px;font-weight:700;color:${doneColor};min-width:44px;text-align:right">${pctDone}%</span>
        </div>
        ${pctAlloc > 100 ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;font-size:12px;color:var(--red)">🔴 Risco de atraso — horas alocadas superam a capacidade da release em ${allocated - globalCap}h</div>` : ""}
        ${pctAlloc > 85 && pctAlloc <= 100 ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:12px;color:var(--yellow)">⚠ Atenção — capacidade da release está ${pctAlloc}% utilizada</div>` : ""}
      </div>

      <div class="rel-detail-section">
        <div class="rel-detail-section-title">Por Desenvolvedor</div>
        ${devRows || `<p style="color:var(--muted);font-size:12px;text-align:center;padding:16px 0">Nenhum desenvolvedor alocado</p>`}
      </div>

      <div class="rel-detail-section" style="border-bottom:none">
        <div class="rel-detail-section-title">Tickets (${relTasks.length})</div>
        <div class="rel-tickets-list">
          ${ticketRows || `<p style="color:var(--muted);font-size:12px;text-align:center;padding:16px 0">Nenhum ticket vinculado</p>`}
        </div>
      </div>`;

    // Close button
    document.getElementById("rel-detail-close")?.addEventListener("click", () => {
      document.getElementById("rel-detail-overlay").classList.remove("open");
    });

    // Clique nos tickets abre o modal de tarefa
    document.querySelectorAll(".rel-ticket-row[data-task-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const t = this.tasks.find((x) => x.id === Number(el.dataset.taskId));
        if (t) this.openModal(t);
      });
    });
  }

  _updateReleaseCapacityInfo() {
    const el  = document.getElementById("r-capacity-info");
    if (!el) return;
    const ini    = document.getElementById("r-inicio")?.value;
    const fim    = document.getElementById("r-fim")?.value;
    const produto = document.getElementById("r-produto")?.value || "Enterprise";
    if (!ini || !fim) { el.style.display = "none"; return; }
    const bdays   = businessDays(ini, fim);
    const devs    = (this.developers || []).filter((d) => d.active !== false);
    const teamCap = devs.reduce((sum, d) => sum + Math.round((d[produto] || 0) * bdays), 0);
    el.style.display = "";
    el.innerHTML = `📅 <strong>${bdays} dias úteis</strong> · Capacidade do time (<strong>${produto}</strong>): <strong style="color:var(--accent)">${teamCap}h</strong> <span style="color:var(--dim)">(feriados BR excluídos)</span>`;
  }

  openEditRelease(releaseId) {
    const rel = this.config.RELEASES.find((r) => r.id === releaseId);
    if (!rel) return;
    this._editingReleaseId = releaseId;
    this._setModalMode("release");
    const ridEl = document.getElementById("r-id");
    if (ridEl) ridEl.readOnly = true;
    document.getElementById("modal-id").textContent           = `#${rel.id}`;
    document.getElementById("modal-tipo-badge").textContent   = "Editar Release";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("r-id").value      = rel.id;
    document.getElementById("r-produto").value = rel.produto;
    document.getElementById("r-inicio").value  = displayToDateInput(rel.dataInicio || "");
    document.getElementById("r-fim").value     = displayToDateInput(rel.dataFim || "");
    document.getElementById("r-status").value  = rel.status;
    document.getElementById("btn-save").textContent = "Salvar Release";
    document.getElementById("modal-overlay").classList.add("open");
    this._updateReleaseCapacityInfo();
  }

  async deleteRelease(releaseId) {
    if (!confirm(`Excluir a release ${releaseId}? Esta ação não pode ser desfeita.`)) return;
    try { await this.dataProvider.deleteRelease?.(releaseId); } catch (e) { console.warn("deleteRelease:", e.message); }
    const idx = this.config.RELEASES.findIndex((r) => r.id === releaseId);
    if (idx >= 0) this.config.RELEASES.splice(idx, 1);
    this.populateSelects();
    this.renderRelease();
    this.renderAll();
  }

  openNewRelease() {
    this._editingReleaseId = null;
    this._setModalMode("release");
    const ridEl = document.getElementById("r-id");
    if (ridEl) ridEl.readOnly = false;
    document.getElementById("modal-id").textContent           = "#Nova";
    document.getElementById("modal-tipo-badge").textContent   = "Nova Release";
    document.getElementById("modal-origem-badge").textContent = "";
    document.getElementById("r-id").value      = "";
    document.getElementById("r-produto").value = "Enterprise";
    document.getElementById("r-inicio").value  = "";
    document.getElementById("r-fim").value     = "";
    document.getElementById("r-status").value  = "Planejado";
    const ci = document.getElementById("r-capacity-info");
    if (ci) ci.style.display = "none";
    document.getElementById("btn-save").textContent = "✚ Criar Release";
    document.getElementById("modal-overlay").classList.add("open");
  }

  _toggleUserMenusSection() {
    const role = document.getElementById("u-role")?.value;
    const sec  = document.getElementById("u-menus-section");
    if (sec) sec.style.display = (role === "admin") ? "none" : "";
  }

  _fillUserMenusCheckboxes(menus) {
    document.querySelectorAll("[name='u-menu']").forEach((cb) => {
      cb.checked = menus.includes(cb.value);
    });
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
    document.getElementById("u-role").value     = "developer";
    document.getElementById("u-active").value   = "true";
    this._fillUserMenusCheckboxes([]);
    this._toggleUserMenusSection();
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
    document.getElementById("u-role").value     = user.role || "developer";
    document.getElementById("u-active").value   = user.active ? "true" : "false";
    this._fillUserMenusCheckboxes(user.menus || []);
    this._toggleUserMenusSection();
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
      const id         = document.getElementById("r-id").value.trim();
      const produto    = document.getElementById("r-produto").value;
      const dataInicio = dateInputToDisplay(document.getElementById("r-inicio").value);
      const dataFim    = dateInputToDisplay(document.getElementById("r-fim").value);
      const status     = document.getElementById("r-status").value;

      if (!id || !produto || !status) { alert("Preencha todos os campos."); return; }
      if (!dataInicio || !dataFim)    { alert("Data de início e data fim são obrigatórias."); return; }

      const relObj = { id, produto, dataInicio, dataFim, status };

      if (this._editingReleaseId) {
        const idx = this.config.RELEASES.findIndex((r) => r.id === this._editingReleaseId);
        if (idx >= 0) this.config.RELEASES[idx] = relObj;
        this._editingReleaseId = null;
        const ridEl = document.getElementById("r-id");
        if (ridEl) ridEl.readOnly = false;
      } else {
        if (this.config.RELEASES.some((r) => r.id === id)) { alert("Release já existe."); return; }
        this.config.RELEASES.push(relObj);
      }

      try { await this.dataProvider.saveRelease?.(relObj); } catch (_) {}
      this.populateSelects();
      this.closeModal();
      if (this.currentView === "release") this.renderRelease();
      this.renderAll();
      return;
    }

    // ── Salvar Desenvolvedor ──
    if (this.modalMode === "developer") {
      const name       = document.getElementById("d-name").value.trim();
      const enterprise = parseFloat(document.getElementById("d-enterprise").value) || 0;
      const clm        = parseFloat(document.getElementById("d-clm").value) || 0;
      const elawon     = parseFloat(document.getElementById("d-elawon").value) || 0;
      const active     = document.getElementById("d-active").value === "true";

      if (!name) { alert("Informe o nome do desenvolvedor."); return; }

      const devObj = { name, Enterprise: enterprise, CLM: clm, ElawOn: elawon, active };

      if (this._editingDevName) {
        const idx = this.developers.findIndex((d) => d.name === this._editingDevName);
        if (idx >= 0) this.developers[idx] = devObj;
        this._editingDevName = null;
      } else {
        if (this.developers.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
          alert("Desenvolvedor já existe."); return;
        }
        this.developers.push(devObj);
      }

      try { await this.dataProvider.saveDeveloper?.(devObj); } catch (e) { console.warn("saveDeveloper:", e.message); }
      this._syncDevConfig();
      this.populateSelects();
      this.closeModal();
      this.renderDevelopers();
      return;
    }

    // ── Salvar Usuário ──
    if (this.modalMode === "user") {
      const username = document.getElementById("u-username").value.trim();
      const name     = document.getElementById("u-name").value.trim();
      const password = document.getElementById("u-password").value.trim();
      const role     = document.getElementById("u-role").value;
      const active   = document.getElementById("u-active").value === "true";
      const menus    = role === "admin"
        ? ["dashboard","backlog","release","developers","integrations","users"]
        : [...document.querySelectorAll("[name='u-menu']:checked")].map((c) => c.value);

      if (!username || !name || !password) {
        alert("Preencha login, nome e senha do usuário.");
        return;
      }

      const existing = this.users.find((u) =>
        (u.username || u.name)?.toLowerCase() === username.toLowerCase()
      );
      if (this.isNewUser && existing) { alert("Usuário já existe."); return; }

      const userData = { username, name, password, role, active, menus };
      try { await this.dataProvider.saveUser?.(userData); } catch (_) {}

      if (existing && !this.isNewUser) {
        Object.assign(existing, userData);
      } else {
        this.users.push(userData);
      }

      this.renderUsers();
      this.closeModal();
      return;
    }

    // ── Salvar Tarefa ──
    // Perfil developer: só pode editar tarefas próprias
    if (this.currentUser?.role === "developer" && !this.isNewTask) {
      const isOwner = this.currentTask?.dev === this.currentUser.name || this.currentTask?.dev === this.currentUser.username;
      if (!isOwner) { alert("Você só pode editar tarefas atribuídas a você."); return; }
    }

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

    // Perfil products: não pode ultrapassar capacidade da release
    if (this.currentUser?.role === "products") {
      const releaseId  = this.currentTask.release;
      const rel        = this.config.RELEASES.find((r) => r.id === releaseId);
      if (rel) {
        const bizDays   = (rel.dataInicio && rel.dataFim) ? businessDays(rel.dataInicio, rel.dataFim) : 0;
        const globalCap = this.developers.filter((d) => d.active !== false)
          .reduce((sum, d) => sum + Math.round((d[rel.produto] || 0) * bizDays), 0);
        const currentAlloc = this.tasks
          .filter((t) => t.release === releaseId && t.id !== this.currentTask.id)
          .reduce((a, t) => a + (t.horasDev || 0) + (t.horasQa || 0), 0);
        const newAlloc = currentAlloc + (this.currentTask.horasDev || 0) + (this.currentTask.horasQa || 0);
        if (globalCap > 0 && newAlloc > globalCap) {
          alert(`⚠ Capacidade da release ${releaseId} excedida.\nCapacidade: ${globalCap}h | Alocado: ${newAlloc}h\nApenas o perfil Administrador pode ultrapassar a capacidade.`);
          return;
        }
      }
    }

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

    this._applyMenuVisibility();
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
