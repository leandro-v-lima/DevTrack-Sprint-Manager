/**
 * SupabaseDataProvider — DevTrack Sprint Manager
 *
 * Implementação concreta do padrão DataProvider usando o Supabase
 * como banco de dados PostgreSQL hospedado na nuvem (free tier).
 *
 * Comportamento de fallback:
 *   Se as credenciais do Supabase não forem configuradas ou a conexão
 *   falhar, o provider opera em modo "memória" usando os dados de
 *   DEVTRACK_CONFIG (INITIAL_TASKS, USERS, RELEASES).
 *
 * Como configurar:
 *   1. Crie um projeto em supabase.com
 *   2. Execute o arquivo database/schema.sql no SQL Editor do Supabase
 *   3. Substitua SUPABASE_URL e SUPABASE_ANON_KEY em app.js
 */

class SupabaseDataProvider {
  /**
   * @param {string} supabaseUrl   - URL do projeto Supabase (ex: https://xxx.supabase.co)
   * @param {string} supabaseKey   - Chave anon/public do Supabase
   */
  constructor(supabaseUrl, supabaseKey) {
    this._url    = supabaseUrl;
    this._key    = supabaseKey;
    this._client = null;
    this._ready  = false;  // false = modo fallback (memória)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tenta conectar ao Supabase. Se falhar, ativa modo fallback (memória).
   */
  async init() {
    const notConfigured =
      !this._url ||
      this._url.includes("SUA_URL_AQUI") ||
      !this._key ||
      this._key.includes("SUA_CHAVE_AQUI");

    if (notConfigured) {
      console.warn("⚠️  Supabase não configurado — operando em modo memória (dados não persistidos).");
      this._ready = false;
      return;
    }

    try {
      // Supabase JS client v2 carregado via CDN no index.html
      this._client = window.supabase.createClient(this._url, this._key);

      // Testa a conexão com uma query leve
      const { error } = await this._client.from("tasks").select("id").limit(1);
      if (error) throw error;

      this._ready = true;
      console.log("✓ Supabase conectado com sucesso.");
    } catch (err) {
      console.warn("⚠️  Erro ao conectar ao Supabase:", err.message, "— modo memória ativado.");
      this._ready = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS: conversão entre formato do app e formato do banco
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Converte linha do banco (snake_case) para objeto Task (camelCase)
   */
  _normalizeTask(row) {
    return {
      id:         row.id,
      ticketOrc:  row.ticket_orc  || "N/A",
      horasDev:   row.horas_dev   || 0,
      horasQa:    row.horas_qa    || 0,
      tipo:       row.tipo        || "NOVA FEATURE",
      classif:    row.classif     || "Evolução",
      modulo:     row.modulo      || "Geral",
      cliente:    row.cliente     || "",
      desc:       row.descricao   || "",
      release:    row.release     || "",
      prioridade: row.prioridade  || "Média",
      status:     row.status      || "Planejado",
      dev:        row.dev         || "",
      demandante: row.demandante  || "",
      dataReg:    row.data_reg    || "",
      origem:     row.origem      || "manual",
      origemId:   row.origem_id   || "",
    };
  }

  /**
   * Converte objeto Task (camelCase) para linha do banco (snake_case)
   */
  _toDbRow(task) {
    return {
      id:          task.id,
      ticket_orc:  task.ticketOrc  ?? "N/A",
      horas_dev:   task.horasDev   ?? 0,
      horas_qa:    task.horasQa    ?? 0,
      tipo:        task.tipo       || "NOVA FEATURE",
      classif:     task.classif    || "Evolução",
      modulo:      task.modulo     || "Geral",
      cliente:     task.cliente    || "",
      descricao:   task.desc       || "",
      release:     task.release    || "",
      prioridade:  task.prioridade || "Média",
      status:      task.status     || "Planejado",
      dev:         task.dev        || "",
      demandante:  task.demandante || "",
      data_reg:    task.dataReg    || "",
      origem:      task.origem     || "manual",
      origem_id:   task.origemId   || "",
      updated_at:  new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todas as tarefas ordenadas por id desc.
   * Fallback: retorna array vazio (app.js usa INITIAL_TASKS quando vazio).
   */
  async getTasks() {
    if (!this._ready) return [];

    const { data, error } = await this._client
      .from("tasks")
      .select("*")
      .order("id", { ascending: false });

    if (error) { console.error("getTasks:", error.message); return []; }
    return data.map((r) => this._normalizeTask(r));
  }

  /**
   * Retorna tarefas filtradas por um objeto de filtros.
   * Em modo Supabase, filtra no banco. Em fallback, retorna [].
   */
  async getTasksFiltered(filters = {}) {
    if (!this._ready) return [];

    let query = this._client.from("tasks").select("*");
    if (filters.status)  query = query.eq("status",  filters.status);
    if (filters.dev)     query = query.eq("dev",     filters.dev);
    if (filters.release) query = query.eq("release", filters.release);
    if (filters.tipo)    query = query.eq("tipo",    filters.tipo);

    const { data, error } = await query.order("id", { ascending: false });
    if (error) { console.error("getTasksFiltered:", error.message); return []; }
    return data.map((r) => this._normalizeTask(r));
  }

  /**
   * Retorna uma tarefa pelo ID
   */
  async getTaskById(id) {
    if (!this._ready) return null;

    const { data, error } = await this._client
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) { console.error("getTaskById:", error.message); return null; }
    return this._normalizeTask(data);
  }

  /**
   * Salva (upsert) uma tarefa existente
   */
  async saveTask(task) {
    if (!this._ready) return task; // modo memória: retorna sem persistir

    const { data, error } = await this._client
      .from("tasks")
      .upsert(this._toDbRow(task), { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error("saveTask: " + error.message);
    return this._normalizeTask(data);
  }

  /**
   * Cria uma nova tarefa
   */
  async createTask(taskData) {
    return this.saveTask(taskData);
  }

  /**
   * Remove uma tarefa pelo ID
   */
  async deleteTask(id) {
    if (!this._ready) return; // modo memória: UI já removeu do array

    const { error } = await this._client
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) throw new Error("deleteTask: " + error.message);
  }

  /**
   * Importa em lote, com deduplicação por origem_id.
   * @returns {{ added: number, dupes: number }}
   */
  async importTasks(newTasks) {
    if (!this._ready) return { added: newTasks.length, dupes: 0 };

    // Busca IDs de origem já existentes no banco
    const { data: existing } = await this._client
      .from("tasks")
      .select("origem_id, id");

    const existingIds = new Set((existing || []).map((t) => t.origem_id || String(t.id)));
    const toInsert    = newTasks.filter((t) => !existingIds.has(t.origemId || String(t.id)));

    if (toInsert.length > 0) {
      const { error } = await this._client
        .from("tasks")
        .insert(toInsert.map((t) => this._toDbRow(t)));

      if (error) throw new Error("importTasks: " + error.message);
    }

    return {
      added: toInsert.length,
      dupes: newTasks.length - toInsert.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USUÁRIOS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todos os usuários ativos.
   * Fallback: retorna DEVTRACK_CONFIG.USERS.
   */
  async getUsers() {
    if (!this._ready) return [...DEVTRACK_CONFIG.USERS];

    const { data, error } = await this._client
      .from("users_devtrack")
      .select("*")
      .order("name");

    if (error) {
      console.error("getUsers:", error.message);
      return [...DEVTRACK_CONFIG.USERS];
    }
    return data;
  }

  /**
   * Valida credenciais de login.
   * Suporta login por username OU name.
   * Fallback: valida contra DEVTRACK_CONFIG.USERS.
   *
   * @param {string} username - Login ou nome do usuário
   * @param {string} password - Senha
   * @returns {Object|null} Objeto usuário ou null se inválido
   */
  async validateUserCredentials(username, password) {
    if (!this._ready) {
      // Fallback: valida na lista estática do config
      const u = DEVTRACK_CONFIG.USERS.find((u) =>
        (u.username === username || u.name === username) &&
        u.password === password &&
        u.active !== false
      );
      return u || null;
    }

    const { data, error } = await this._client
      .from("users_devtrack")
      .select("*")
      .or(`username.eq.${username},name.eq.${username}`)
      .eq("password", password)
      .eq("active", true)
      .maybeSingle();

    if (error) { console.error("validateUserCredentials:", error.message); return null; }
    return data || null;
  }

  /**
   * Salva (upsert) um usuário
   */
  async saveUser(user) {
    if (!this._ready) return user;

    const { data, error } = await this._client
      .from("users_devtrack")
      .upsert(user, { onConflict: "username" })
      .select()
      .single();

    if (error) throw new Error("saveUser: " + error.message);
    return data;
  }

  /**
   * Remove um usuário pelo username
   */
  async deleteUser(username) {
    if (!this._ready) return;

    const { error } = await this._client
      .from("users_devtrack")
      .delete()
      .eq("username", username);

    if (error) throw new Error("deleteUser: " + error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELEASES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna todas as releases ordenadas por id.
   * Fallback: retorna DEVTRACK_CONFIG.RELEASES.
   */
  async getReleases() {
    if (!this._ready) return [...DEVTRACK_CONFIG.RELEASES];

    const { data, error } = await this._client
      .from("releases")
      .select("*")
      .order("id");

    if (error || !data || data.length === 0) return [...DEVTRACK_CONFIG.RELEASES];

    return data.map((r) => ({
      id:       r.id,
      produto:  r.produto,
      dataFim:  r.data_fim,
      status:   r.status,
    }));
  }

  /**
   * Salva (upsert) uma release
   */
  async saveRelease(release) {
    if (!this._ready) return release;

    const row = {
      id:          release.id,
      produto:     release.produto,
      data_inicio: release.dataInicio || "",
      data_fim:    release.dataFim,
      status:      release.status,
    };

    const { data, error } = await this._client
      .from("releases")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error("saveRelease: " + error.message);
    return { id: data.id, produto: data.produto, dataFim: data.data_fim, status: data.status };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METADADOS (retornam sempre da config estática — não precisam de DB)
  // ─────────────────────────────────────────────────────────────────────────

  async getStatuses() { return [...DEVTRACK_CONFIG.STATUS_LIST]; }
  async getTypes()    { return [...DEVTRACK_CONFIG.TIPOS]; }
  async getModules()  { return [...DEVTRACK_CONFIG.MODULOS]; }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGS DE IMPORTAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra uma entrada de log de importação no banco
   */
  async logImport(tipo, total, adicionados, duplicatas) {
    if (!this._ready) return; // modo memória: log fica só em tela

    await this._client.from("import_logs").insert({
      tipo,
      total,
      adicionados,
      duplicatas,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS DO PROVIDER
  // ─────────────────────────────────────────────────────────────────────────

  /** Indica se o Supabase está conectado (false = modo memória) */
  isConnected() { return this._ready; }
}
