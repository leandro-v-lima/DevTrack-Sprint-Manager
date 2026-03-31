/**
 * SupabaseDataProvider — DevTrack Sprint Manager
 *
 * Implementação concreta do padrão DataProvider usando o Supabase
 * como banco de dados PostgreSQL hospedado na nuvem (free tier).
 *
 * Comportamento de fallback:
 *   Se as credenciais do Supabase não forem configuradas ou a conexão
 *   falhar, o provider opera em modo "memória" usando os dados de
 *   DEVTRACK_CONFIG (INITIAL_TASKS, USERS, RELEASES, DEVELOPERS).
 */

class SupabaseDataProvider {
  constructor(supabaseUrl, supabaseKey) {
    this._url    = supabaseUrl;
    this._key    = supabaseKey;
    this._client = null;
    this._ready  = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

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
      this._client = window.supabase.createClient(this._url, this._key);
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
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────

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
      status:     row.status      || "Pendente",
      dev:        row.dev         || "",
      demandante: row.demandante  || "",
      dataReg:    row.data_reg    || "",
      origem:     row.origem      || "manual",
      origemId:   row.origem_id   || "",
      produto:    row.produto     || "Enterprise",
    };
  }

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
      status:      task.status     || "Pendente",
      dev:         task.dev        || "",
      demandante:  task.demandante || "",
      data_reg:    task.dataReg    || "",
      origem:      task.origem     || "manual",
      origem_id:   task.origemId   || "",
      produto:     task.produto    || "Enterprise",
      updated_at:  new Date().toISOString(),
    };
  }

  /**
   * Normaliza um row de usuário do banco para o formato esperado pelo app.
   * Garante que `menus` seja sempre um array JS, mesmo que venha como
   * string JSON ou null do banco.
   */
  _normalizeUser(row) {
    let menus = row.menus || [];
    if (typeof menus === "string") {
      try { menus = JSON.parse(menus); } catch (_) { menus = []; }
    }
    if (!Array.isArray(menus)) menus = [];

    // Compatibilidade: mapeia role legado "user" → "developer"
    const role = row.role === "user" ? "developer" : (row.role || "developer");

    return {
      username:  row.username || row.name,
      name:      row.name     || row.username,
      password:  row.password || "",
      role,
      menus,
      active:    row.active !== false,
    };
  }

  _normalizeDeveloper(row) {
    return {
      name:       row.name,
      Enterprise: parseFloat(row.enterprise) || 0,
      CLM:        parseFloat(row.clm)        || 0,
      ElawOn:     parseFloat(row.elawon)     || 0,
      active:     row.active !== false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────────────────────────────────

  async getTasks() {
    if (!this._ready) return [];
    const { data, error } = await this._client
      .from("tasks")
      .select("*")
      .order("id", { ascending: false });
    if (error) { console.error("getTasks:", error.message); return []; }
    return data.map((r) => this._normalizeTask(r));
  }

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

  async getTaskById(id) {
    if (!this._ready) return null;
    const { data, error } = await this._client
      .from("tasks").select("*").eq("id", id).single();
    if (error) { console.error("getTaskById:", error.message); return null; }
    return this._normalizeTask(data);
  }

  async saveTask(task) {
    if (!this._ready) return task;
    const { data, error } = await this._client
      .from("tasks")
      .upsert(this._toDbRow(task), { onConflict: "id" })
      .select().single();
    if (error) throw new Error("saveTask: " + error.message);
    return this._normalizeTask(data);
  }

  async createTask(taskData) {
    return this.saveTask(taskData);
  }

  async deleteTask(id) {
    if (!this._ready) return;
    const { error } = await this._client.from("tasks").delete().eq("id", id);
    if (error) throw new Error("deleteTask: " + error.message);
  }

  async importTasks(newTasks) {
    if (!this._ready) return { added: newTasks.length, dupes: 0 };
    const { data: existing } = await this._client
      .from("tasks").select("origem_id, id");
    const existingIds = new Set((existing || []).map((t) => t.origem_id || String(t.id)));
    const toInsert    = newTasks.filter((t) => !existingIds.has(t.origemId || String(t.id)));
    if (toInsert.length > 0) {
      const { error } = await this._client.from("tasks").insert(toInsert.map((t) => this._toDbRow(t)));
      if (error) throw new Error("importTasks: " + error.message);
    }
    return { added: toInsert.length, dupes: newTasks.length - toInsert.length };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USUÁRIOS
  // ─────────────────────────────────────────────────────────────────────────

  async getUsers() {
    if (!this._ready) return DEVTRACK_CONFIG.USERS.map((u) => ({ ...u }));
    const { data, error } = await this._client
      .from("users_devtrack").select("*").order("name");
    if (error) {
      console.error("getUsers:", error.message);
      return DEVTRACK_CONFIG.USERS.map((u) => ({ ...u }));
    }
    return data.map((r) => this._normalizeUser(r));
  }

  async validateUserCredentials(username, password) {
    if (!this._ready) {
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
    if (!data) return null;
    return this._normalizeUser(data);
  }

  async saveUser(user) {
    if (!this._ready) return user;

    // Serializa menus como JSONB — Supabase JS aceita array direto
    const row = {
      username: user.username,
      name:     user.name,
      password: user.password,
      role:     user.role     || "developer",
      menus:    Array.isArray(user.menus) ? user.menus : [],
      active:   user.active !== false,
    };

    const { data, error } = await this._client
      .from("users_devtrack")
      .upsert(row, { onConflict: "username" })
      .select().single();
    if (error) throw new Error("saveUser: " + error.message);
    return this._normalizeUser(data);
  }

  async deleteUser(username) {
    if (!this._ready) return;
    const { error } = await this._client
      .from("users_devtrack").delete().eq("username", username);
    if (error) throw new Error("deleteUser: " + error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESENVOLVEDORES
  // ─────────────────────────────────────────────────────────────────────────

  async getDevelopers() {
    if (!this._ready) {
      return (DEVTRACK_CONFIG.DEVELOPERS || []).map((d) => ({ ...d }));
    }
    const { data, error } = await this._client
      .from("developers").select("*").order("name");
    if (error) {
      console.error("getDevelopers:", error.message);
      return (DEVTRACK_CONFIG.DEVELOPERS || []).map((d) => ({ ...d }));
    }
    return data.map((r) => this._normalizeDeveloper(r));
  }

  async saveDeveloper(dev) {
    if (!this._ready) return dev;
    const row = {
      name:       dev.name,
      enterprise: dev.Enterprise || 0,
      clm:        dev.CLM        || 0,
      elawon:     dev.ElawOn     || 0,
      active:     dev.active !== false,
    };
    const { data, error } = await this._client
      .from("developers")
      .upsert(row, { onConflict: "name" })
      .select().single();
    if (error) throw new Error("saveDeveloper: " + error.message);
    return this._normalizeDeveloper(data);
  }

  async deleteDeveloper(name) {
    if (!this._ready) return;
    const { error } = await this._client
      .from("developers").delete().eq("name", name);
    if (error) throw new Error("deleteDeveloper: " + error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELEASES
  // ─────────────────────────────────────────────────────────────────────────

  async getReleases() {
    if (!this._ready) return DEVTRACK_CONFIG.RELEASES.map((r) => ({ ...r }));

    const { data, error } = await this._client
      .from("releases").select("*").order("id");

    if (error || !data || data.length === 0) {
      return DEVTRACK_CONFIG.RELEASES.map((r) => ({ ...r }));
    }

    return data.map((r) => ({
      id:         r.id,
      produto:    r.produto,
      dataInicio: r.data_inicio || "",
      dataFim:    r.data_fim,
      status:     r.status,
    }));
  }

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
      .select().single();

    if (error) throw new Error("saveRelease: " + error.message);
    return {
      id:         data.id,
      produto:    data.produto,
      dataInicio: data.data_inicio || "",
      dataFim:    data.data_fim,
      status:     data.status,
    };
  }

  async deleteRelease(id) {
    if (!this._ready) return;
    const { error } = await this._client
      .from("releases").delete().eq("id", id);
    if (error) throw new Error("deleteRelease: " + error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APONTAMENTO DE HORAS (TIME ENTRIES)
  // ─────────────────────────────────────────────────────────────────────────

  _normalizeTimeEntry(row) {
    return {
      id:     row.id,
      taskId: row.task_id,
      dev:    row.dev    || "",
      data:   row.data   || "",
      horas:  parseFloat(row.horas) || 0,
    };
  }

  async getAllTimeEntries() {
    if (!this._ready) return [];
    const { data, error } = await this._client
      .from("time_entries").select("*").order("data");
    if (error) { console.error("getAllTimeEntries:", error.message); return []; }
    return data.map((r) => this._normalizeTimeEntry(r));
  }

  async getTimeEntriesForTask(taskId) {
    if (!this._ready) return [];
    const { data, error } = await this._client
      .from("time_entries").select("*").eq("task_id", taskId).order("data");
    if (error) { console.error("getTimeEntriesForTask:", error.message); return []; }
    return data.map((r) => this._normalizeTimeEntry(r));
  }

  async saveTimeEntry(entry) {
    if (!this._ready) return { ...entry, id: Date.now() };
    const row = { task_id: entry.taskId, dev: entry.dev || "", data: entry.data, horas: entry.horas };
    const { data, error } = await this._client
      .from("time_entries").insert(row).select().single();
    if (error) throw new Error("saveTimeEntry: " + error.message);
    return this._normalizeTimeEntry(data);
  }

  async deleteTimeEntry(id) {
    if (!this._ready) return;
    const { error } = await this._client.from("time_entries").delete().eq("id", id);
    if (error) throw new Error("deleteTimeEntry: " + error.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // METADADOS (retornam da config estática)
  // ─────────────────────────────────────────────────────────────────────────

  async getStatuses() { return [...DEVTRACK_CONFIG.STATUS_LIST]; }
  async getTypes()    { return [...DEVTRACK_CONFIG.TIPOS]; }
  async getModules()  { return [...DEVTRACK_CONFIG.MODULOS]; }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGS DE IMPORTAÇÃO
  // ─────────────────────────────────────────────────────────────────────────

  async logImport(tipo, total, adicionados, duplicatas) {
    if (!this._ready) return;
    await this._client.from("import_logs").insert({ tipo, total, adicionados, duplicatas });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS DO PROVIDER
  // ─────────────────────────────────────────────────────────────────────────

  isConnected() { return this._ready; }
}
