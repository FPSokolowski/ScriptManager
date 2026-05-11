// Frontend rebuilt from Stitch artifacts in miscData/stitch_script_management_studio.
const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const pageContent = document.getElementById("page-content");
const pageTitleElement = document.getElementById("page-title");
const pageSubtitleElement = document.getElementById("page-subtitle");
const topActionsElement = document.getElementById("top-actions");
const primaryActionsElement = document.getElementById("page-primary-actions");
const searchShellElement = document.getElementById("toolbar-search-shell");
const searchInputElement = document.getElementById("toolbar-search-input");
const sidebarVersionElement = document.getElementById("sidebar-version");

const ui = {
  page: "Scripts",
  data: null,
  search: "",
  automationSearch: "",
  display: "cards",
  envTarget: "User",
  collapsed: new Set(),
  pending: new Map()
};

window.chrome?.webview?.addEventListener("message", event => {
  const message = event.data;
  const pending = ui.pending.get(message.id);
  if (!pending) return;
  ui.pending.delete(message.id);
  message.ok ? pending.resolve(message.data) : pending.reject(new Error(message.error || "Host error"));
});

window.ScriptManager = { refresh };

function api(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    ui.pending.set(id, { resolve, reject });
    chrome.webview.postMessage({ id, action, payload: { environmentTarget: ui.envTarget, ...payload } });
  });
}

async function refresh() {
  ui.data = await api("getState", { environmentTarget: ui.envTarget });
  ui.envTarget = ui.data.environmentTarget || ui.envTarget;
  document.body.classList.toggle("light", ui.data.settings?.theme === "Light");
  render();
}

function render() {
  pageTitleElement.textContent = pageTitle();
  pageSubtitleElement.textContent = pageSubtitle();
  topActionsElement.innerHTML = toolbar();
  primaryActionsElement.innerHTML = pagePrimaryActions();
  pageContent.innerHTML = page();
  sidebarVersionElement.textContent = ui.data?.appVersion || "";
  searchShellElement.hidden = ui.page !== "Scripts" && ui.page !== "Automations";
  searchInputElement.placeholder = ui.page === "Automations" ? "Search automation..." : "Search scripts...";
  searchInputElement.value = ui.page === "Automations" ? ui.automationSearch : ui.search;
  document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === ui.page));
  bind();
}

function toolbar() {
  if (ui.page === "Scripts") {
    return `
      ${tool("collapse_all", "Collapse Groups", "collapse")}
      <div class="button-group">
        ${tool("grid_view", "Cards", "display-cards", ui.display === "cards")}
        ${tool("view_list", "List", "display-list", ui.display === "list")}
      </div>
      ${tool("autorenew", "Update all scripts", "update-all", true)}
      <div class="divider-y"></div>
      ${tool("box_add", "New group", "create-script-group")}
      ${tool("attach_file_add", "Import scripts", "import")}
      ${tool("add_circle", "Create new script", "create-script")}
    `;
  }
  if (ui.page === "Automations") {
    return `${tool("box_add", "New group", "create-automation-group")}${tool("shutter_speed_add", "Create automation", "create-automation", true)}`;
  }
  if (ui.page === "Settings") {
    const themeIcon = ui.data?.settings?.theme === "Light" ? "dark_mode" : "light_mode";
    return `${tool(themeIcon, "Toggle theme", "toggle-theme", true)}`;
  }
  return "";
}

function tool(iconName, title, action, active = false) {
  return `<button class="icon-button ${active ? "active" : ""}" title="${title}" data-action="${action}">${icon(iconName)}</button>`;
}

function pageTitle() {
  return ui.page === "Scripts" ? "Script Dashboard" : ui.page;
}

function pageSubtitle() {
  return {
    Scripts: "Manage, sync and execute your collected automation scripts.",
    Automations: "Compose script/configuration pairs into sequential workflows.",
    Logs: "Execution history with terminal output and step-level automation status.",
    Settings: "Runtime defaults, theme and execution behavior.",
    "Environment Variables": "Browse, add and update user or system environment variables."
  }[ui.page];
}

function pagePrimaryActions() {
  if (ui.page === "Scripts") {
    return `
      <button class="ghost-button" data-action="create-script-group">${icon("box_add")} New Group</button>
      <button class="ghost-button" data-action="import">${icon("attach_file_add")} Add Script</button>
      <button class="primary-button" data-action="create-script">${icon("add_circle")} Create New</button>
    `;
  }
  if (ui.page === "Automations") {
    return `<button class="primary-button" data-action="create-automation">${icon("shutter_speed_add")} Create Automation</button>`;
  }
  return "";
}

function page() {
  if (!ui.data) return "";
  if (ui.page === "Scripts") return scriptsPage();
  if (ui.page === "Automations") return automationsPage();
  if (ui.page === "Logs") return logsPage();
  if (ui.page === "Environment Variables") return environmentPage();
  return settingsPage();
}

function scriptsPage() {
  const query = ui.search.toLowerCase();
  const scripts = (ui.data.scripts || []).filter(script => !query || [script.name, script.localPath, script.originalPath, script.group].some(x => (x || "").toLowerCase().includes(query)));
  if (!scripts.length) return `<div class="panel">No scripts collected yet. Use Add Script or Create New.</div>`;
  return groupSections(scripts, script => script.group || "Default", items => ui.display === "list"
    ? `<div class="common-list">${items.map(scriptListRow).join("")}</div>`
    : `<div class="card-grid">${items.map(scriptCard).join("")}</div>`);
}

function groupSections(items, getGroup, renderItems) {
  return Object.entries(groupBy(items, getGroup)).map(([group, groupItems]) => {
    const isCollapsed = ui.collapsed.has(group);
    return `
      <section>
        <div class="section-toggle" data-collapse="${escAttr(group)}">${icon(isCollapsed ? "chevron_right" : "expand_more")} ${esc(group)} (${groupItems.length})</div>
        ${isCollapsed ? "" : renderItems(groupItems)}
      </section>
    `;
  }).join("");
}

function scriptCard(script) {
  return `
    <article class="script-card" data-script-open="${script.id}">
      <div class="card-top">
        <div class="script-title"><span class="script-icon">${icon("terminal")}</span><span>${esc(script.name)}</span></div>
        ${status(script.status)}
      </div>
      <div class="meta">${esc(script.description || script.localPath || "")}</div>
      <div class="card-actions">
        <button class="primary-button" data-run-menu="${script.id}">${icon("play_arrow")} Run Script</button>
        <button class="ghost-button" data-script-open="${script.id}">${icon("info")} Details</button>
      </div>
    </article>
  `;
}

function scriptListRow(script) {
  const config = [...(script.configurations || [])].sort((a, b) => a.order - b.order)[0];
  return `
    <div class="list-row">
      <div>
        <div class="script-title"><span class="script-icon">${icon("terminal")}</span><span>${esc(script.name)}</span></div>
        <div class="meta code-font">${esc(script.originalPath || script.localPath || "")}</div>
      </div>
      <div class="inline-actions">
        ${status(script.status)}
        <button class="icon-button" title="Details" data-script-open="${script.id}">${icon("info")}</button>
        <button class="icon-button active" title="Run default configuration" data-run-script="${script.id}" data-config="${config?.id || ""}">${icon("play_arrow")}</button>
      </div>
    </div>
  `;
}

function automationsPage() {
  const query = ui.automationSearch.toLowerCase();
  const automations = (ui.data.automations || []).filter(automation => !query || [automation.name, automation.description, automation.group].some(x => (x || "").toLowerCase().includes(query)));
  if (!automations.length) return `<div class="panel">No automations yet. Create one and add script/configuration pairs.</div>`;
  return groupSections(automations, automation => automation.group || "Default", items => `
    <div class="card-grid">
      ${items.map(automation => `
        <article class="automation-card">
          <div class="card-top">
            <div class="script-title"><span class="script-icon">${icon("account_tree")}</span><span>${esc(automation.name)}</span></div>
            <span class="status-pill">${automation.steps?.length || 0} steps</span>
          </div>
          <div class="meta">${esc(automation.description || "No description")}</div>
          <div class="meta code-font">Modified ${formatDate(automation.lastModifiedAt)}</div>
          <div class="card-actions">
            <button class="primary-button" data-run-automation="${automation.id}">${icon("play_arrow")} Run</button>
            <button class="ghost-button" data-automation-open="${automation.id}">${icon("info")} Details</button>
          </div>
        </article>
      `).join("")}
    </div>
  `);
}

function logsPage() {
  const logs = ui.data.logs || [];
  return `
    <div class="terminal-box">
      ${logs.length ? logs.map(log => `
        <button class="log-line ${String(log.result).toLowerCase()}" data-log-open="${log.id}">
          <span>${formatDate(log.startedAt)}</span>
          <span>${esc(log.result)}</span>
          <span>${esc(log.type)}</span>
          <span>${esc(log.name)}</span>
          <span>${esc(log.configuration || "")}</span>
        </button>
      `).join("") : "No logs yet."}
    </div>
  `;
}

function settingsPage() {
  const settings = ui.data.settings || {};
  const update = ui.data.updateInfo || {};
  return `
    <div class="settings-grid">
      <section class="panel">
        <h2 class="panel-title">Runtime</h2>
        <div class="form-grid">
          <label>Default terminal</label>
          <select id="default-terminal">${["Auto", "pwsh", "powershell", "wt", "cmd"].map(x => `<option ${settings.defaultTerminal === x ? "selected" : ""}>${x}</option>`).join("")}</select>
          <label><input id="open-terminal" type="checkbox" ${settings.openTerminalWindow ? "checked" : ""}> Open terminal window when supported</label>
          <label><input id="stop-on-failure" type="checkbox" ${settings.stopAutomationOnFailure ? "checked" : ""}> Stop automation on first failure</label>
          <p class="meta">Success detection is process-based: exit code 0 is success, non-zero or thrown errors are failure. Domain failures should return non-zero.</p>
          <button class="primary-button" data-action="save-settings">${icon("save")} Save Settings</button>
        </div>
      </section>
      <section class="panel version-card">
        <h2 class="panel-title">Application Version</h2>
        <div class="version-row"><span>Installed</span><strong>${esc(ui.data.appVersion || "unknown")}</strong></div>
        <div class="version-row"><span>Latest</span><strong>${esc(update.latestVersion || "unknown")}</strong></div>
        <div class="version-row"><span>Status</span>${updateStatus(update.status)}</div>
        <div class="version-row"><span>Checked</span><strong>${update.checkedAt ? formatDate(update.checkedAt) : "never"}</strong></div>
        ${update.message ? `<p class="meta">${esc(update.message)}</p>` : ""}
        <div class="inline-actions">
          <button class="ghost-button" data-action="check-updates">${icon("autorenew")} Check Version</button>
          ${update.status === "OUTDATED" ? `<button class="primary-button" data-action="download-update">${icon("download")} Download Installer</button>` : ""}
        </div>
      </section>
    </div>
  `;
}

function environmentPage() {
  const env = ui.data.environmentVariables || [];
  return `
    <section class="panel">
      <div class="panel-heading-row">
        <select id="env-target" aria-label="Environment scope">
          <option ${ui.envTarget === "User" ? "selected" : ""}>User</option>
          <option ${ui.envTarget === "Machine" ? "selected" : ""}>Machine</option>
        </select>
        <span class="meta">Switching target reloads the list from the selected environment scope.</span>
      </div>
      <div class="env-list custom-scrollbar">
        ${env.map(item => `
          <div class="env-row">
            <div class="env-name">${esc(item.name)}</div>
            <div class="env-value">${esc(item.value || "(empty)")}</div>
          </div>
        `).join("") || `<div class="meta">No environment variables found.</div>`}
      </div>
    </section>
    <section class="panel">
      <h2 class="panel-title">Add or Update</h2>
      <div class="form-grid">
        <input id="env-name" placeholder="Variable name">
        <textarea id="env-value" placeholder="Value"></textarea>
        <button class="primary-button" data-action="save-env">${icon("arrow_circle_up")} Save Variable</button>
      </div>
    </section>
  `;
}

function bind() {
  document.querySelectorAll("[data-page]").forEach(button => button.onclick = () => { ui.page = button.dataset.page; render(); });
  document.querySelectorAll("[data-action]").forEach(button => button.onclick = () => handleAction(button.dataset.action));
  searchInputElement.oninput = event => {
    if (ui.page === "Automations") ui.automationSearch = event.target.value;
    else ui.search = event.target.value;
    render();
  };
  document.querySelector("#env-target")?.addEventListener("change", async event => { ui.envTarget = event.target.value; await refresh(); });
  document.querySelectorAll("[data-collapse]").forEach(button => button.onclick = () => toggleCollapse(button.dataset.collapse));
  document.querySelectorAll("[data-run-menu]").forEach(button => button.onclick = () => showRunMenu(button.dataset.runMenu));
  document.querySelectorAll("[data-run-script]").forEach(button => button.onclick = () => runScript(button.dataset.runScript, button.dataset.config));
  document.querySelectorAll("[data-script-open]").forEach(button => button.onclick = event => { event.stopPropagation(); showScriptDetails(button.dataset.scriptOpen); });
  document.querySelectorAll("[data-run-automation]").forEach(button => button.onclick = () => runAutomation(button.dataset.runAutomation));
  document.querySelectorAll("[data-automation-open]").forEach(button => button.onclick = () => showAutomationDetails(button.dataset.automationOpen));
  document.querySelectorAll("[data-log-open]").forEach(button => button.onclick = () => showLog(button.dataset.logOpen));
}

async function handleAction(action) {
  try {
    if (action === "collapse") return toggleAllGroups();
    if (action === "display-cards") return setDisplay("cards");
    if (action === "display-list") return setDisplay("list");
    if (action === "update-all") return await call("updateAllScripts");
    if (action === "import") return showImportModal();
    if (action === "create-script") return showCreateScriptModal();
    if (action === "create-script-group") return showGroupModal("script");
    if (action === "create-automation") return showCreateAutomationModal();
    if (action === "create-automation-group") return showGroupModal("automation");
    if (action === "toggle-theme") return await call("saveSettings", { ...ui.data.settings, theme: ui.data.settings.theme === "Light" ? "Dark" : "Light" });
    if (action === "save-settings") return await saveSettings();
    if (action === "save-env") return await call("setEnvironmentVariable", { name: value("env-name"), value: value("env-value"), environmentTarget: ui.envTarget });
    if (action === "check-updates") return await call("checkForUpdates");
    if (action === "download-update") return await call("downloadAndRunInstaller");
  } catch (error) {
    showError(error.message);
  }
}

function toggleAllGroups() {
  const groups = [...new Set((ui.data.scripts || []).map(script => script.group || "Default"))];
  ui.collapsed.size ? ui.collapsed.clear() : groups.forEach(group => ui.collapsed.add(group));
  render();
}

function setDisplay(display) {
  ui.display = display;
  render();
}

function toggleCollapse(group) {
  ui.collapsed.has(group) ? ui.collapsed.delete(group) : ui.collapsed.add(group);
  render();
}

async function call(action, payload = {}) {
  ui.data = await api(action, payload);
  document.body.classList.toggle("light", ui.data.settings?.theme === "Light");
  render();
}

function showImportModal() {
  modal("Add Script", `
    <div class="drop-zone">
      <div>
        <div class="script-icon" style="margin:0 auto 12px">${icon("upload")}</div>
        <strong>Drop script files onto the app window</strong>
        <p class="meta">or use the file picker to collect scripts into ScriptManager.</p>
      </div>
    </div>
  `, async () => call("importScripts"));
}

function showCreateScriptModal() {
  modal("Create New Script", `
    <div class="form-grid">
      <input id="script-name" placeholder="Script name">
      <select id="script-extension"><option>.ps1</option><option>.cmd</option><option>.bat</option><option>.sh</option><option>.py</option><option>.js</option><option>.sql</option></select>
      <textarea id="script-content" class="terminal-box" placeholder="Write commands line by line"></textarea>
    </div>
  `, async () => call("createScript", { name: value("script-name"), extension: value("script-extension"), content: value("script-content") }));
}

function showGroupModal(type) {
  modal("New Group", `
    <div class="form-grid">
      <input id="group-name" placeholder="Group name">
      <textarea id="group-description" placeholder="Description"></textarea>
    </div>
  `, async () => call(type === "automation" ? "createAutomationGroup" : "createScriptGroup", { name: value("group-name"), description: value("group-description") }));
}

async function showScriptDetails(id) {
  const script = ui.data.scripts.find(item => item.id === id);
  const code = await api("getScriptCode", { scriptId: id });
  modal("Script Details", `
    <div class="form-grid">
      <input id="edit-script-name" value="${escAttr(script.name)}">
      <textarea id="edit-script-description" placeholder="Description">${esc(script.description || "")}</textarea>
      <select id="edit-script-group">${ui.data.scriptGroups.map(group => `<option value="${group.id}" ${group.id === script.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
      <div class="meta code-font">${esc(script.originalPath || "Local script created in app")}</div>
      <div class="terminal-box">${esc(code)}</div>
      <div class="inline-actions">
        <button class="ghost-button" data-modal-action="save-script">${icon("save")} Save</button>
        <button class="ghost-button" data-modal-action="add-config">${icon("add")} Config</button>
        <button class="ghost-button" data-modal-action="delete-script">${icon("delete")} Delete</button>
      </div>
      <div class="common-list">${[...(script.configurations || [])].sort((a,b) => a.order - b.order).map(configItem).join("")}</div>
    </div>
  `);
  bindScriptDetails(script);
}

function configItem(config) {
  return `
    <div class="config-item" draggable="true" data-config-row="${config.id}">
      <span class="drag-handle">::</span>
      <div><strong>${esc(config.name)}</strong><div class="meta code-font">...${esc(tail(config.workingDirectory || "", 24))}</div></div>
      <div class="inline-actions">
        <button class="icon-button" title="Edit" data-config-edit="${config.id}">${icon("edit")}</button>
        <button class="icon-button" title="Duplicate" data-config-copy="${config.id}">${icon("content_copy")}</button>
        <button class="icon-button" title="Delete" data-config-delete="${config.id}">${icon("delete")}</button>
        <button class="icon-button active" title="Run" data-config-run="${config.id}">${icon("play_arrow")}</button>
      </div>
    </div>
  `;
}

function bindScriptDetails(script) {
  modalRoot.querySelector('[data-modal-action="save-script"]').onclick = async () => {
    await call("updateScript", { scriptId: script.id, name: value("edit-script-name"), description: value("edit-script-description"), groupId: value("edit-script-group") });
    closeModal();
  };
  modalRoot.querySelector('[data-modal-action="delete-script"]').onclick = async () => { await call("deleteScript", { scriptId: script.id }); closeModal(); };
  modalRoot.querySelector('[data-modal-action="add-config"]').onclick = () => showConfigModal(script, null);
  modalRoot.querySelectorAll("[data-config-edit]").forEach(button => button.onclick = () => showConfigModal(script, script.configurations.find(c => c.id === button.dataset.configEdit)));
  modalRoot.querySelectorAll("[data-config-copy]").forEach(button => button.onclick = async () => { await call("duplicateConfiguration", { scriptId: script.id, configurationId: button.dataset.configCopy }); closeModal(); });
  modalRoot.querySelectorAll("[data-config-delete]").forEach(button => button.onclick = async () => { await call("deleteConfiguration", { scriptId: script.id, configurationId: button.dataset.configDelete }); closeModal(); });
  modalRoot.querySelectorAll("[data-config-run]").forEach(button => button.onclick = async () => { await runScript(script.id, button.dataset.configRun); closeModal(); });
  bindConfigDrag(script.id);
}

function bindConfigDrag(scriptId) {
  let dragged = null;
  modalRoot.querySelectorAll("[data-config-row]").forEach(row => {
    row.ondragstart = () => { dragged = row; };
    row.ondragover = event => event.preventDefault();
    row.ondrop = async event => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      row.parentElement.insertBefore(dragged, row);
      await call("reorderConfigurations", { scriptId, configurationIds: [...modalRoot.querySelectorAll("[data-config-row]")].map(item => item.dataset.configRow) });
      closeModal();
    };
  });
}

function showConfigModal(script, config) {
  modal(config ? "Edit Configuration" : "New Configuration", `
    <div class="form-grid">
      <input id="cfg-name" placeholder="Name" value="${escAttr(config?.name || "Default")}">
      <textarea id="cfg-description" placeholder="Description">${esc(config?.description || "")}</textarea>
      <input id="cfg-working" placeholder="Working directory" value="${escAttr(config?.workingDirectory || "")}">
      <label><input id="cfg-admin" type="checkbox" ${config?.runAsAdmin ? "checked" : ""}> Run as administrator</label>
      <textarea id="cfg-params" placeholder="One parameter per line: name=value">${esc((config?.parameters || []).map(p => `${p.name}=${p.value}`).join("\n"))}</textarea>
    </div>
  `, async () => {
    const runAsAdmin = document.getElementById("cfg-admin").checked;
    if (runAsAdmin && !config?.runAsAdmin && !confirm("This configuration may elevate privileges. Confirm that you trust this script and parameters.")) return;
    await call("saveConfiguration", {
      scriptId: script.id,
      configuration: {
        id: config?.id || "",
        name: value("cfg-name"),
        description: value("cfg-description"),
        workingDirectory: value("cfg-working"),
        runAsAdmin,
        parameters: parseParams(value("cfg-params"))
      }
    });
    closeModal();
  });
}

function showRunMenu(scriptId) {
  const script = ui.data.scripts.find(item => item.id === scriptId);
  modal("Run Script", `<div class="common-list">${[...(script.configurations || [])].sort((a,b) => a.order - b.order).map(config => `
    <div class="config-item">
      <span></span>
      <button class="ghost-button" style="justify-content:flex-start" data-run-config="${config.id}">${esc(config.name)}</button>
      <button class="icon-button" title="Info" data-info-config="${config.id}">${icon("info")}</button>
    </div>
  `).join("")}</div>`);
  modalRoot.querySelectorAll("[data-run-config]").forEach(button => button.onclick = async () => { await runScript(scriptId, button.dataset.runConfig); closeModal(); });
  modalRoot.querySelectorAll("[data-info-config]").forEach(button => button.onclick = () => showConfigInfo(script, script.configurations.find(c => c.id === button.dataset.infoConfig)));
}

function showConfigInfo(script, config) {
  modal("Configuration Details", `
    <div class="form-grid">
      <div class="script-title">${esc(config.name)}</div>
      <div class="meta">Script: ${esc(script.name)}</div>
      <div class="meta code-font">Working directory: ${esc(config.workingDirectory || "")}</div>
      <div class="terminal-box">${esc((config.parameters || []).map(p => `${p.name}=${p.value}`).join("\n") || "No parameters")}</div>
      <button class="ghost-button" data-edit-config="${config.id}">${icon("edit")} Edit</button>
    </div>
  `);
  modalRoot.querySelector("[data-edit-config]").onclick = () => showConfigModal(script, config);
}

async function runScript(scriptId, configurationId) {
  if (!configurationId) return;
  await call("runScript", { scriptId, configurationId });
  ui.page = "Logs";
  render();
}

function showCreateAutomationModal() {
  modal("Create Automation", `
    <div class="form-grid">
      <input id="automation-name" placeholder="Automation name">
      <textarea id="automation-description" placeholder="Description"></textarea>
      <select id="automation-group">${ui.data.automationGroups.map(group => `<option value="${group.id}">${esc(group.name)}</option>`).join("")}</select>
    </div>
  `, async () => call("createAutomation", { name: value("automation-name"), description: value("automation-description"), groupId: value("automation-group") }));
}

function showAutomationDetails(id) {
  const automation = ui.data.automations.find(item => item.id === id);
  const steps = [...(automation.steps || [])].sort((a,b) => a.order - b.order);
  modal("Automation Details", `
    <div class="form-grid">
      <input id="automation-edit-name" value="${escAttr(automation.name)}">
      <textarea id="automation-edit-description">${esc(automation.description || "")}</textarea>
      <select id="automation-edit-group">${ui.data.automationGroups.map(group => `<option value="${group.id}" ${group.id === automation.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
      <div class="inline-actions">
        <button class="ghost-button" data-auto-action="save">${icon("save")} Save</button>
        <button class="ghost-button" data-auto-action="add">${icon("add")} Add Pair</button>
        <button class="ghost-button" data-auto-action="delete">${icon("delete")} Delete</button>
      </div>
      <div class="common-list">
        ${steps.map(step => {
          const script = ui.data.scripts.find(s => s.id === step.scriptId);
          const config = script?.configurations?.find(c => c.id === step.configurationId);
          return `<div class="list-row"><div>${step.order + 1}. ${esc(script?.name || "missing")} / ${esc(config?.name || "missing")}</div><button class="ghost-button" data-remove-step="${step.order}">${icon("delete")} Remove</button></div>`;
        }).join("") || `<div class="meta">No script/configuration pairs yet.</div>`}
      </div>
      <button class="primary-button" data-run-auto="${automation.id}">${icon("play_arrow")} Run Automation</button>
    </div>
  `);
  modalRoot.querySelector('[data-auto-action="save"]').onclick = async () => { await call("updateAutomation", { automationId: automation.id, name: value("automation-edit-name"), description: value("automation-edit-description"), groupId: value("automation-edit-group") }); closeModal(); };
  modalRoot.querySelector('[data-auto-action="delete"]').onclick = async () => { await call("deleteAutomation", { automationId: automation.id }); closeModal(); };
  modalRoot.querySelector('[data-auto-action="add"]').onclick = () => showAddStepModal(automation.id);
  modalRoot.querySelector("[data-run-auto]").onclick = async () => { await runAutomation(automation.id); closeModal(); };
  modalRoot.querySelectorAll("[data-remove-step]").forEach(button => button.onclick = async () => { await call("removeAutomationStep", { automationId: automation.id, order: Number(button.dataset.removeStep) }); closeModal(); });
}

function showAddStepModal(automationId) {
  modal("Add Script + Configuration", `
    <div class="form-grid">
      <select id="step-script">${ui.data.scripts.map(script => `<option value="${script.id}">${esc(script.name)}</option>`).join("")}</select>
      <select id="step-config"></select>
    </div>
  `, async () => call("addAutomationStep", { automationId, scriptId: value("step-script"), configurationId: value("step-config") }));
  const scriptSelect = document.getElementById("step-script");
  const configSelect = document.getElementById("step-config");
  const sync = () => {
    const script = ui.data.scripts.find(item => item.id === scriptSelect.value);
    configSelect.innerHTML = (script?.configurations || []).map(config => `<option value="${config.id}">${esc(config.name)}</option>`).join("");
  };
  scriptSelect.onchange = sync;
  sync();
}

async function runAutomation(automationId) {
  await call("runAutomation", { automationId });
  ui.page = "Logs";
  render();
}

function showLog(id) {
  const log = ui.data.logs.find(item => item.id === id);
  modal("Log Details", `
    <div class="form-grid">
      <div class="script-title">${esc(log.type)}: ${esc(log.name)}</div>
      <div class="meta code-font">${formatDate(log.startedAt)} -> ${formatDate(log.finishedAt)} | ${esc(log.result)} | exit ${log.exitCode}</div>
      ${(log.steps || []).map(step => `<div class="status-pill ${step.result === "Success" ? "ok" : "error"}">${esc(step.result)} ${esc(step.scriptName)} / ${esc(step.configurationName)} exit ${step.exitCode}</div>`).join("")}
      <div class="terminal-box">&gt; ${esc(log.commandLine || "")}\n${esc(log.terminalOutput || "")}</div>
    </div>
  `);
}

async function saveSettings() {
  await call("saveSettings", {
    theme: ui.data.settings.theme,
    defaultTerminal: value("default-terminal"),
    openTerminalWindow: document.getElementById("open-terminal").checked,
    stopAutomationOnFailure: document.getElementById("stop-on-failure").checked
  });
}

function modal(title, body, onConfirm = null) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar">
        <h2 class="modal-title">${esc(title)}</h2>
        ${body}
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel</button>
          ${onConfirm ? `<button class="primary-button" data-modal-confirm>Confirm</button>` : ""}
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  const confirm = modalRoot.querySelector("[data-modal-confirm]");
  if (confirm) confirm.onclick = async () => {
    try {
      await onConfirm();
      closeModal();
    } catch (error) {
      showError(error.message);
    }
  };
}

function closeModal() { modalRoot.innerHTML = ""; }
function showError(message) { modal("Error", `<div class="terminal-box">${esc(message)}</div>`); }

function status(value) {
  const statusClass = value === "Current" ? "ok" : value === "UpdatedFromSource" ? "warn" : ["SourceMissing", "LocalMissing", "Error"].includes(value) ? "error" : "";
  return `<span class="status-pill ${statusClass}">status: ${esc(value || "Unknown")}</span>`;
}

function updateStatus(value) {
  const statusClass = value === "UPTODATE" ? "ok" : value === "OUTDATED" ? "warn" : "error";
  return `<span class="status-pill ${statusClass}">${esc(value || "NOINFO")}</span>`;
}

function icon(name) {
  const map = {
    terminal: "terminal_2",
    terminal_2: "terminal_2",
    search: "search",
    collapse_all: "collapse_all",
    grid_view: "grid_view",
    view_list: "view_list",
    autorenew: "autorenew",
    settings: "settings",
    upload: "upload",
    attach_file_add: "attach_file_add",
    add: "add",
    add_circle: "add_circle",
    account_tree: "account_tree",
    coffee_maker: "coffee_maker",
    perm_data_setting: "perm_data_setting",
    history: "history",
    browse_activity: "browse_activity",
    play_arrow: "play_arrow",
    info: "info",
    save: "save",
    arrow_circle_up: "arrow_circle_up",
    delete: "delete",
    edit: "edit",
    content_copy: "content_copy",
    download: "download",
    box_add: "box_add",
    shutter_speed_add: "shutter_speed_add",
    dark_mode: "dark_mode",
    light_mode: "light_mode",
    expand_more: "expand_more",
    chevron_right: "chevron_right"
  };
  return `<span class="material-symbols-outlined" data-icon="${escAttr(name)}">${map[name] || name}</span>`;
}

function parseParams(text) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const index = line.indexOf("=");
    return index < 0 ? { name: line, value: "" } : { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
  });
}

function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function value(id) { return document.getElementById(id)?.value || ""; }
function tail(text, length) { return text.length <= length ? text : text.slice(-length); }
function formatDate(value) { return value ? new Date(value).toLocaleString() : ""; }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
function escAttr(value) { return esc(value).replace(/`/g, "&#96;"); }

refresh().catch(error => showError(error.message));
