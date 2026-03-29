/**
 * Manipulador de CSV — DevTrack Sprint Manager
 * Importação, parsing e preview de arquivos CSV/TXT.
 */

class CSVHandler {

  /**
   * Faz o parse de um texto CSV/TXT em array de objetos Task.
   * Auto-detecta o delimitador: vírgula, ponto-e-vírgula, pipe ou tab.
   *
   * @param {string} text - Conteúdo bruto do arquivo
   * @returns {Array} Array de objetos Task normalizados
   */
  static parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0]
      .split(/[,;|\t]/)
      .map((h) => h.replace(/^["']|["']$/g, "").trim());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
        .split(/[,;|\t]/)
        .map((c) => c.replace(/^["']|["']$/g, "").trim());
      if (cols.some((c) => c))
        rows.push(CSVHandler.csvRowToTask(cols, headers));
    }
    return rows;
  }

  /**
   * Converte uma linha do CSV em objeto Task.
   * Faz mapeamento inteligente de colunas (fuzzy matching de nomes de header).
   * Normaliza status, tipo e nome do desenvolvedor.
   *
   * @param {string[]} row - Valores da linha
   * @param {string[]} headers - Nomes das colunas
   * @returns {Object} Objeto Task normalizado
   */
  static csvRowToTask(row, headers) {
    // Busca valor por substring no nome do header
    const get = (key) => {
      const idx = headers.findIndex((h) => h?.toLowerCase().includes(key.toLowerCase()));
      return idx >= 0 ? (row[idx] || "").toString().trim() : "";
    };

    const rawId  = get("código") || get("codigo") || get("id") || get("code");
    const numId  = parseInt(rawId.replace(/\D/g, "")) || Math.floor(Math.random() * 90000 + 100000);
    const rawSt  = get("estágio") || get("estagio") || get("status");
    const rawTipo = get("assunto") || get("categoria") || get("subject");
    const rawDev  = get("responsável") || get("responsavel") || get("assignee");

    // Normalização de status
    const statusMap = {
      "em atendimento":  "Em Desenvolvimento",
      "atendimento":     "Em Desenvolvimento",
      "pendente":        "Planejado",
      "aberto":          "Planejado",
      "resolvido":       "Concluído",
      "fechado":         "Concluído",
      "em homologação":  "Em Homologação - QA",
      "bloqueado":       "Bloqueado",
    };
    const statusNorm =
      Object.entries(statusMap).find(([k]) => rawSt.toLowerCase().includes(k))?.[1] || "Planejado";

    // Normalização de tipo
    const tipoUp = rawTipo.toUpperCase();
    const tipoNorm =
      tipoUp.includes("BUG")    ? "DÉBITO TÉCNICO" :
      tipoUp.includes("VULN")   ? "VULNERABILIDADE" :
      tipoUp.includes("CUSTOM") ? "CUSTOMIZAÇÃO" :
      "NOVA FEATURE";

    // Fuzzy match de nome do desenvolvedor
    const devNorm =
      DEVTRACK_CONFIG.DEVS.find((d) => rawDev.toLowerCase().includes(d.toLowerCase())) || "Alexandre";

    return {
      id:         numId,
      ticketOrc:  rawId || "N/A",
      horasDev:   0,
      horasQa:    0,
      tipo:       tipoNorm,
      classif:    "Evolução",
      modulo:     "Geral",
      cliente:    get("cliente") || get("client") || "N/A",
      desc:       get("titulo") || get("título") || get("assunto") || get("summary") || "Ticket " + rawId,
      release:    "7.14.0",
      prioridade: "Média",
      status:     statusNorm,
      dev:        devNorm,
      demandante: get("solicitante") || get("requester") || "",
      dataReg:    new Date().toLocaleDateString("pt-BR"),
      origem:     "csv",
      origemId:   rawId,
    };
  }

  /**
   * Renderiza a tabela de pré-visualização da importação.
   * Destaca registros duplicados com aviso visual.
   *
   * @param {Array} csvPreview - Tarefas lidas do CSV
   * @param {Array} tasks - Tarefas já existentes (para verificar duplicatas)
   */
  static renderPreview(csvPreview, tasks) {
    const existingIds = new Set(tasks.map((t) => t.origemId || String(t.id)));
    const news        = csvPreview.filter((t) => !existingIds.has(t.origemId));

    const countEl = document.getElementById("preview-count");
    const newEl   = document.getElementById("new-count");
    if (countEl) countEl.textContent = csvPreview.length;
    if (newEl)   newEl.textContent   = news.length;

    const tbody = document.getElementById("preview-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    csvPreview.forEach((t) => {
      const exists = existingIds.has(t.origemId);
      const ps = DEVTRACK_CONFIG.PRIO_STYLE[t.prioridade] || DEVTRACK_CONFIG.PRIO_STYLE["Baixa"];
      const ss = DEVTRACK_CONFIG.STATUS_STYLE[t.status] || {};

      const tr = document.createElement("tr");
      if (exists) tr.style.background = "#1c1505";

      tr.innerHTML = `
        <td style="font-family:monospace;color:var(--muted);font-size:11px">
          ${t.origemId}${exists ? ' <span style="font-size:9px;color:#f59e0b">⚠ já existe</span>' : ""}
        </td>
        <td>
          <span class="badge" style="background:var(--bg);color:${DEVTRACK_CONFIG.TIPO_STYLE[t.tipo]?.color || "#fff"};border:1px solid ${DEVTRACK_CONFIG.TIPO_STYLE[t.tipo]?.color || "#fff"}30">
            ${t.tipo}
          </span>
        </td>
        <td>
          <span class="badge" style="background:${ss.bg};color:${ss.color};border:1px solid ${ss.color}30">
            ${t.status}
          </span>
        </td>
        <td style="color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cliente}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.desc}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center">
            ${avatarHTML(t.dev, 18)}
            <span>${t.dev}</span>
          </div>
        </td>`;

      tbody.appendChild(tr);
    });

    const section = document.getElementById("csv-preview-section");
    if (section) section.style.display = "";
  }

  /**
   * Cancela o preview e limpa o input de arquivo
   */
  static cancelPreview() {
    const section = document.getElementById("csv-preview-section");
    const fileInput = document.getElementById("csv-file");
    if (section)   section.style.display = "none";
    if (fileInput) fileInput.value = "";
  }
}
