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
const cheatSearchShellElement = document.getElementById("cheat-search-shell");
const cheatSearchGroupElement = document.getElementById("cheat-search-group");
const cheatSearchInputElement = document.getElementById("cheat-search-input");
const sidebarVersionElement = document.getElementById("sidebar-version");
const colorPalette = ["#4fdbc8", "#c0c1ff", "#ffb783", "#f472b6", "#22c55e", "#38bdf8", "#facc15", "#fb7185", "#a78bfa", "#34d399", "#f97316", "#e879f9", "#2dd4bf", "#60a5fa"];
// Google Material Symbols are free to use under the Apache License 2.0.
const iconCatalog = [
  "terminal_2", "code", "data_object", "play_arrow", "settings", "build", "bolt", "rocket_launch", "account_tree", "schema", "hub", "lan", "cloud", "database", "storage", "folder", "inventory_2", "book_ribbon", "article", "description", "fact_check", "check_circle", "warning", "error", "security", "lock", "key", "shield", "sync", "autorenew", "schedule", "timer", "memory", "speed", "monitoring", "analytics", "search", "edit", "delete", "download", "upload", "swap_vert", "box_add", "add_circle", "coffee_maker", "perm_data_setting", "browse_activity",
  "brand:linux", "brand:ubuntu", "brand:debian", "brand:fedora", "brand:arch", "brand:alpine", "brand:kali", "brand:redhat", "brand:opensuse", "brand:mint", "brand:windows", "brand:powershell", "brand:wsl", "brand:cmd", "brand:bash", "brand:zsh", "brand:fish", "brand:macos", "brand:homebrew", "brand:chocolatey", "brand:npm", "brand:node", "brand:yarn", "brand:pnpm", "brand:git", "brand:github", "brand:gitlab", "brand:bitbucket", "brand:docker", "brand:kubernetes", "brand:python", "brand:nuget", "brand:dotnet", "brand:winget", "brand:scoop"
];
const brandIconLabels = {
  "brand:linux": "LNX",
  "brand:ubuntu": "UBU",
  "brand:debian": "DEB",
  "brand:fedora": "FED",
  "brand:arch": "ARC",
  "brand:alpine": "ALP",
  "brand:kali": "KLI",
  "brand:redhat": "RHT",
  "brand:opensuse": "SUS",
  "brand:mint": "MNT",
  "brand:windows": "WIN",
  "brand:powershell": "PS",
  "brand:wsl": "WSL",
  "brand:cmd": "CMD",
  "brand:bash": "BSH",
  "brand:zsh": "ZSH",
  "brand:fish": "FSH",
  "brand:macos": "MAC",
  "brand:homebrew": "BRW",
  "brand:chocolatey": "CHO",
  "brand:npm": "NPM",
  "brand:node": "NOD",
  "brand:yarn": "YRN",
  "brand:pnpm": "PNP",
  "brand:git": "GIT",
  "brand:github": "GH",
  "brand:gitlab": "GL",
  "brand:bitbucket": "BB",
  "brand:docker": "DKR",
  "brand:kubernetes": "K8S",
  "brand:python": "PY",
  "brand:nuget": "NUG",
  "brand:dotnet": ".NET",
  "brand:winget": "WGT",
  "brand:scoop": "SCP"
};

const ui = {
  page: "Scripts",
  data: null,
  search: "",
  automationSearch: "",
  cheatSearch: "",
  cheatPendingSearch: "",
  cheatGroup: "all",
  cheatSearchTimer: null,
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
  cheatSearchShellElement.hidden = ui.page !== "Cheat Sheet";
  if (ui.page === "Cheat Sheet") {
    cheatSearchGroupElement.innerHTML = `<option value="all">All groups</option>${(ui.data.cheatSheetGroups || []).map(group => `<option value="${group.id}" ${ui.cheatGroup === group.id ? "selected" : ""}>${esc(group.name)}</option>`).join("")}`;
    cheatSearchInputElement.value = ui.cheatPendingSearch;
  }
  searchInputElement.placeholder = ui.page === "Automations" ? "Search automation..." : "Search scripts...";
  searchInputElement.value = ui.page === "Automations" ? ui.automationSearch : ui.search;
  document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === ui.page));
  bind();
}

function toolbar() {
  return renderToolbarActions(toolbarActions());
}

function toolbarActions() {
  if (ui.page === "Scripts") {
    return [
      { icon: "collapse_all", title: "Collapse Groups", action: "collapse" },
      {
        group: [
          { icon: "grid_view", title: "Cards", action: "display-cards", active: ui.display === "cards" },
          { icon: "view_list", title: "List", action: "display-list", active: ui.display === "list" }
        ]
      },
      { icon: "autorenew", title: "Update all scripts", action: "update-all", active: true },
      { divider: true },
      { icon: "box_add", title: "New group", action: "create-script-group" },
      { icon: "attach_file_add", title: "Import scripts", action: "import" },
      { icon: "add_circle", title: "Create new script", action: "create-script" }
    ];
  }
  if (ui.page === "Automations") {
    return [
      { icon: "box_add", title: "New group", action: "create-automation-group" },
      { icon: "shutter_speed_add", title: "Create automation", action: "create-automation", active: true }
    ];
  }
  if (ui.page === "Cheat Sheet") {
    return [
      { icon: "box_add", title: "New group", action: "create-cheat-group" },
      { icon: "add_circle", title: "New snippet", action: "create-cheat-entry", active: true }
    ];
  }
  if (ui.page === "Import & Backup") {
    return [
      { icon: "upload", title: "Import backup", action: "import-backup" },
      { icon: "download", title: "Export backup", action: "export-backup", active: true }
    ];
  }
  if (ui.page === "Environment Variables") {
    return [{ icon: "edit_document", title: "Add or update variable", action: "open-env-editor", active: true }];
  }
  if (ui.page === "Settings") {
    const themeIcon = ui.data?.settings?.theme === "Light" ? "dark_mode" : "light_mode";
    return [{ icon: themeIcon, title: "Toggle theme", action: "toggle-theme", active: true }];
  }
  return [];
}

function renderToolbarActions(items) {
  const actions = flattenToolbarItems(items);
  if (!actions.length) return "";
  const visible = items.map(item => {
    if (item.divider) return `<div class="divider-y responsive-action"></div>`;
    if (item.group) return `<div class="button-group responsive-action">${item.group.map(groupItem => tool(groupItem.icon, groupItem.title, groupItem.action, groupItem.active)).join("")}</div>`;
    return tool(item.icon, item.title, item.action, item.active, "responsive-action");
  }).join("");
  const menu = actions.map(action => `
    <button class="overflow-menu-item" data-action="${action.action}">
      ${icon(action.icon)}
      <span>${esc(action.title)}</span>
    </button>
  `).join("");
  return `
    ${visible}
    <div class="top-overflow">
      <button class="icon-button top-overflow-toggle" title="More actions" aria-label="More actions" aria-haspopup="menu" type="button">${icon("more_vert")}</button>
      <div class="top-overflow-menu" role="menu">${menu}</div>
    </div>
  `;
}

function flattenToolbarItems(items) {
  return items.flatMap(item => item.group ? item.group : item.divider ? [] : [item]);
}

function tool(iconName, title, action, active = false, extraClass = "") {
  return `<button class="icon-button ${active ? "active" : ""} ${extraClass}" title="${title}" data-action="${action}">${icon(iconName)}</button>`;
}

function pageTitle() {
  return ui.page === "Scripts" ? "Script Dashboard" : ui.page;
}

function pageSubtitle() {
  return {
    Scripts: "Manage, sync and execute your collected automation scripts.",
    Automations: "Compose script/configuration pairs into sequential workflows.",
    "Cheat Sheet": "Keep reusable script fragments grouped, searchable and close at hand.",
    "Import & Backup": "Export the full app library to a portable ZIP or import it back.",
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
  if (ui.page === "Cheat Sheet") {
    return `
      <button class="ghost-button" data-action="create-cheat-group">${icon("box_add")} New Group</button>
      <button class="primary-button" data-action="create-cheat-entry">${icon("add_circle")} New Snippet</button>
    `;
  }
  if (ui.page === "Import & Backup") {
    return `
      <button class="ghost-button" data-action="import-backup">${icon("upload")} Import Backup</button>
      <button class="primary-button" data-action="export-backup">${icon("download")} Export Backup</button>
    `;
  }
  if (ui.page === "Environment Variables") {
    return `<button class="primary-button" data-action="open-env-editor">${icon("edit_document")} Add or Update</button>`;
  }
  return "";
}

function page() {
  if (!ui.data) return "";
  if (ui.page === "Scripts") return scriptsPage();
  if (ui.page === "Automations") return automationsPage();
  if (ui.page === "Cheat Sheet") return cheatSheetPage();
  if (ui.page === "Import & Backup") return importBackupPage();
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
    : `<div class="card-grid">${items.map(scriptCard).join("")}</div>`, group => findByName(ui.data.scriptGroups, group)?.color, group => findByName(ui.data.scriptGroups, group), "script");
}

function groupSections(items, getGroup, renderItems, getColor = null, getGroupRecord = null, groupType = null) {
  return Object.entries(groupBy(items, getGroup)).map(([group, groupItems]) => {
    const isCollapsed = ui.collapsed.has(group);
    const groupColor = colorValue(getColor?.(group));
    const record = getGroupRecord?.(group);
    return `
      <section>
        <div class="section-header">
          <div class="section-toggle" data-collapse="${escAttr(group)}" style="color:${escAttr(groupColor)}">${icon(isCollapsed ? "chevron_right" : "expand_more")} ${esc(group)} (${groupItems.length})</div>
          ${record && groupType ? `<button class="icon-button" title="Edit group" data-group-edit="${record.id}" data-group-type="${groupType}">${icon("edit")}</button>` : ""}
        </div>
        ${isCollapsed ? "" : renderItems(groupItems)}
      </section>
    `;
  }).join("");
}

function scriptCard(script) {
  return `
    <article class="script-card accented" style="--item-color:${escAttr(colorValue(script.color))}" data-script-open="${script.id}">
      <div class="card-top">
        <div class="script-title"><span class="script-icon">${icon(script.icon || "terminal_2")}</span><span>${esc(script.name)}</span></div>
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
        <div class="script-title"><span class="script-icon">${icon(script.icon || "terminal_2")}</span><span>${esc(script.name)}</span></div>
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
        <article class="automation-card accented" style="--item-color:${escAttr(colorValue(automation.color))}">
          <div class="card-top">
            <div class="script-title"><span class="script-icon">${icon(automation.icon || "account_tree")}</span><span>${esc(automation.name)}</span></div>
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
  `, group => findByName(ui.data.automationGroups, group)?.color, group => findByName(ui.data.automationGroups, group), "automation");
}

function cheatSheetPage() {
  const groups = ui.data.cheatSheetGroups || [];
  const entries = ui.data.cheatSheetEntries || [];
  const query = ui.cheatSearch.toLowerCase();
  const visibleEntries = entries.filter(entry => {
    const groupMatch = ui.cheatGroup === "all" || entry.groupId === ui.cheatGroup;
    const textMatch = !query || [entry.code, entry.name, entry.description].some(x => (x || "").toLowerCase().includes(query));
    return groupMatch && textMatch;
  });

  if (!groups.length) {
    return `<div class="panel">No Cheat Sheet groups yet. Create one to start collecting snippets.</div>`;
  }

  return groups.map(group => {
    const groupEntries = visibleEntries.filter(entry => entry.groupId === group.id);
    if ((ui.cheatGroup !== "all" && ui.cheatGroup !== group.id) || !groupEntries.length && query) return "";
    return `
      <section>
        <div class="section-toggle" data-cheat-group-open="${group.id}" style="color:${escAttr(colorValue(group.color))}">${icon(group.icon || "book_ribbon")} ${esc(group.name)} (${groupEntries.length})</div>
        <div class="card-grid">
          ${groupEntries.map(entry => `
            <article class="script-card accented" style="--item-color:${escAttr(colorValue(entry.color))}" data-cheat-entry-open="${entry.id}">
              <div class="card-top">
                <div class="script-title"><span class="script-icon">${icon("terminal")}</span><span>${esc(entry.name || "Untitled snippet")}</span></div>
              </div>
              <div class="meta">${esc(entry.description || "")}</div>
              <pre class="cheat-code">${esc(entry.code || "")}</pre>
              <div class="card-actions">
                <button class="ghost-button" data-cheat-entry-open="${entry.id}">${icon("edit")} Edit</button>
              </div>
            </article>
          `).join("") || `<div class="panel">No snippets in this group.</div>`}
        </div>
      </section>
    `;
  }).join("");
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

function importBackupPage() {
  return `
    <div class="settings-grid">
      <section class="panel">
        <h2 class="panel-title">Export / Backup</h2>
        <p class="meta">Creates a ZIP with one manifest JSON for app settings, script metadata, automations and Cheat Sheet data, plus folders for script files and log outputs.</p>
        <div class="backup-actions">
          <button class="primary-button" data-action="export-backup">${icon("download")} Export Backup</button>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Import</h2>
        <p class="meta">Imports a ScriptManager backup ZIP. Existing objects with the same IDs are updated; missing objects are added.</p>
        <div class="backup-actions">
          <button class="ghost-button" data-action="import-backup">${icon("upload")} Import Backup</button>
        </div>
      </section>
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
  `;
}

function showEnvironmentVariableModal() {
  modal("Add or Update Environment Variable", `
    <div class="form-grid">
      <input id="env-name" placeholder="Variable name">
      <textarea id="env-value" placeholder="Value"></textarea>
      <p class="meta">Scope: ${esc(ui.envTarget)}</p>
    </div>
  `, async () => call("setEnvironmentVariable", { name: value("env-name"), value: value("env-value"), environmentTarget: ui.envTarget }));
}

function bind() {
  document.querySelectorAll("[data-page]").forEach(button => button.onclick = () => { ui.page = button.dataset.page; render(); });
  document.querySelectorAll("[data-action]").forEach(button => button.onclick = () => handleAction(button.dataset.action));
  searchInputElement.oninput = event => {
    if (ui.page === "Automations") ui.automationSearch = event.target.value;
    else ui.search = event.target.value;
    render();
  };
  cheatSearchGroupElement.onchange = event => {
    ui.cheatGroup = event.target.value;
    render();
  };
  cheatSearchInputElement.oninput = event => {
    ui.cheatPendingSearch = event.target.value;
    clearTimeout(ui.cheatSearchTimer);
    ui.cheatSearchTimer = setTimeout(() => {
      ui.cheatSearch = ui.cheatPendingSearch;
      render();
    }, 1000);
  };
  document.querySelector("#env-target")?.addEventListener("change", async event => { ui.envTarget = event.target.value; await refresh(); });
  document.querySelectorAll("[data-collapse]").forEach(button => button.onclick = () => toggleCollapse(button.dataset.collapse));
  document.querySelectorAll("[data-run-menu]").forEach(button => button.onclick = () => showRunMenu(button.dataset.runMenu));
  document.querySelectorAll("[data-run-script]").forEach(button => button.onclick = () => runScript(button.dataset.runScript, button.dataset.config));
  document.querySelectorAll("[data-script-open]").forEach(button => button.onclick = event => { event.stopPropagation(); showScriptDetails(button.dataset.scriptOpen); });
  document.querySelectorAll("[data-run-automation]").forEach(button => button.onclick = () => runAutomation(button.dataset.runAutomation));
  document.querySelectorAll("[data-automation-open]").forEach(button => button.onclick = () => showAutomationDetails(button.dataset.automationOpen));
  document.querySelectorAll("[data-log-open]").forEach(button => button.onclick = () => showLog(button.dataset.logOpen));
  document.querySelectorAll("[data-group-edit]").forEach(button => button.onclick = event => {
    event.stopPropagation();
    const source = button.dataset.groupType === "automation" ? ui.data.automationGroups : ui.data.scriptGroups;
    showGroupEditModal(button.dataset.groupType, source.find(group => group.id === button.dataset.groupEdit));
  });
  document.querySelectorAll("[data-cheat-group-open]").forEach(button => button.onclick = () => showCheatGroupModal(ui.data.cheatSheetGroups.find(group => group.id === button.dataset.cheatGroupOpen)));
  document.querySelectorAll("[data-cheat-entry-open]").forEach(button => button.onclick = event => { event.stopPropagation(); showCheatEntryModal(ui.data.cheatSheetEntries.find(entry => entry.id === button.dataset.cheatEntryOpen)); });
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
    if (action === "create-cheat-group") return showCheatGroupModal(null);
    if (action === "create-cheat-entry") return showCheatEntryModal(null);
    if (action === "toggle-theme") return await call("saveSettings", { ...ui.data.settings, theme: ui.data.settings.theme === "Light" ? "Dark" : "Light" });
    if (action === "save-settings") return await saveSettings();
    if (action === "open-env-editor") return showEnvironmentVariableModal();
    if (action === "save-env") return await call("setEnvironmentVariable", { name: value("env-name"), value: value("env-value"), environmentTarget: ui.envTarget });
    if (action === "check-updates") return await call("checkForUpdates");
    if (action === "download-update") return await call("downloadAndRunInstaller");
    if (action === "export-backup") return await call("exportBackup");
    if (action === "import-backup") return await confirmModal("Import backup", "Importing a backup updates existing objects with matching IDs and adds missing data. Continue?", () => call("importBackup"));
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
      ${iconPicker("script-icon", "terminal_2")}
      ${colorPicker("script-color", "#c0c1ff")}
      <textarea id="script-content" class="terminal-box" placeholder="Write commands line by line"></textarea>
    </div>
  `, async () => call("createScript", { name: value("script-name"), extension: value("script-extension"), content: value("script-content"), icon: value("script-icon"), color: value("script-color") }));
  bindIconPicker("script-icon");
  bindColorPicker("script-color");
}

function showGroupModal(type) {
  const fallbackColor = type === "automation" ? "#ffb783" : "#4fdbc8";
  modal("New Group", `
    <div class="form-grid">
      <input id="group-name" placeholder="Group name">
      <textarea id="group-description" placeholder="Description"></textarea>
      ${colorPicker("group-color", fallbackColor)}
    </div>
  `, async () => call(type === "automation" ? "createAutomationGroup" : "createScriptGroup", { name: value("group-name"), description: value("group-description"), color: value("group-color") }));
  bindColorPicker("group-color");
}

function showGroupEditModal(type, group) {
  const isAutomation = type === "automation";
  modal(isAutomation ? "Edit Automation Group" : "Edit Script Group", `
    ${modalAccent(group.color)}
    <div class="form-grid">
      <input id="edit-group-name" placeholder="Group name" value="${escAttr(group.name || "")}">
      <textarea id="edit-group-description" placeholder="Description">${esc(group.description || "")}</textarea>
      ${colorPicker("edit-group-color", group.color || (isAutomation ? "#ffb783" : "#4fdbc8"))}
      <button class="ghost-button" data-delete-group="${group.id}">${icon("delete")} Delete Group</button>
    </div>
  `, async () => call(isAutomation ? "updateAutomationGroup" : "updateScriptGroup", {
    groupId: group.id,
    name: value("edit-group-name"),
    description: value("edit-group-description"),
    color: value("edit-group-color")
  }));
  bindColorPicker("edit-group-color");
  modalRoot.querySelector("[data-delete-group]").onclick = event => {
    event.preventDefault();
    const phrase = `delete group ${group.name}`;
    phraseConfirm(isAutomation ? "Delete Automation Group" : "Delete Script Group", phrase, async () => {
      await call(isAutomation ? "deleteAutomationGroup" : "deleteScriptGroup", { groupId: group.id });
      closeModal();
    });
  };
}

function showCheatGroupModal(group) {
  const isEdit = Boolean(group);
  modal(isEdit ? "Edit Cheat Sheet Group" : "New Cheat Sheet Group", `
    ${modalAccent(group?.color)}
    <div class="form-grid">
      <input id="cheat-group-name" placeholder="Group name" value="${escAttr(group?.name || "")}">
      ${iconPicker("cheat-group-icon", group?.icon || "book_ribbon")}
      ${colorPicker("cheat-group-color", group?.color || "#4fdbc8")}
      ${isEdit ? `<button class="ghost-button" data-delete-cheat-group="${group.id}">${icon("delete")} Delete Group</button>` : ""}
    </div>
  `, async () => call("saveCheatSheetGroup", { groupId: group?.id || "", name: value("cheat-group-name"), icon: value("cheat-group-icon"), color: value("cheat-group-color") }));
  bindIconPicker("cheat-group-icon");
  bindColorPicker("cheat-group-color");
  const deleteButton = modalRoot.querySelector("[data-delete-cheat-group]");
  if (deleteButton) deleteButton.onclick = async event => {
    event.preventDefault();
    const phrase = `delete group ${group.name}`;
    phraseConfirm("Delete Cheat Sheet Group", phrase, async () => {
      await call("deleteCheatSheetGroup", { groupId: group.id });
      closeModal();
    });
  };
}

function showCheatEntryModal(entry) {
  const groups = ui.data.cheatSheetGroups || [];
  const selectedGroupId = entry?.groupId || (ui.cheatGroup !== "all" ? ui.cheatGroup : groups[0]?.id || "");
  const isEdit = Boolean(entry);
  modal(isEdit ? "Edit Cheat Sheet Snippet" : "New Cheat Sheet Snippet", `
    ${modalAccent(entry?.color)}
    <div class="form-grid">
      <input id="cheat-entry-name" placeholder="Name" value="${escAttr(entry?.name || "")}">
      <textarea id="cheat-entry-description" placeholder="Description">${esc(entry?.description || "")}</textarea>
      <select id="cheat-entry-group">${groups.map(group => `<option value="${group.id}" ${group.id === selectedGroupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
      ${colorPicker("cheat-entry-color", entry?.color || "#c0c1ff")}
      <textarea id="cheat-entry-code" class="terminal-box" placeholder="Code">${esc(entry?.code || "")}</textarea>
      ${isEdit ? `<button class="ghost-button" data-delete-cheat-entry="${entry.id}">${icon("delete")} Delete Snippet</button>` : ""}
    </div>
  `, async () => call("saveCheatSheetEntry", { entryId: entry?.id || "", groupId: value("cheat-entry-group"), name: value("cheat-entry-name"), description: value("cheat-entry-description"), code: value("cheat-entry-code"), color: value("cheat-entry-color") }));
  bindColorPicker("cheat-entry-color");
  const deleteButton = modalRoot.querySelector("[data-delete-cheat-entry]");
  if (deleteButton) deleteButton.onclick = async event => {
    event.preventDefault();
    confirmModal("Delete snippet", `Delete Cheat Sheet snippet "${entry.name || "Untitled snippet"}"?`, async () => {
      await call("deleteCheatSheetEntry", { entryId: entry.id });
      closeModal();
    });
  };
}

async function showScriptDetails(id) {
  const script = ui.data.scripts.find(item => item.id === id);
  const code = await api("getScriptCode", { scriptId: id });
  modal("Script Details", `
    ${modalAccent(script.color)}
    <div class="form-grid">
      <input id="edit-script-name" value="${escAttr(script.name)}">
      <textarea id="edit-script-description" placeholder="Description">${esc(script.description || "")}</textarea>
      <select id="edit-script-group">${ui.data.scriptGroups.map(group => `<option value="${group.id}" ${group.id === script.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
      ${iconPicker("edit-script-icon", script.icon || "terminal_2")}
      ${colorPicker("edit-script-color", script.color || "#c0c1ff")}
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
  bindIconPicker("edit-script-icon");
  bindColorPicker("edit-script-color");
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
    await call("updateScript", { scriptId: script.id, name: value("edit-script-name"), description: value("edit-script-description"), groupId: value("edit-script-group"), icon: value("edit-script-icon"), color: value("edit-script-color") });
    closeModal();
  };
  modalRoot.querySelector('[data-modal-action="delete-script"]').onclick = () => confirmModal("Delete script", `Delete script "${script.name}"?`, async () => {
    await call("deleteScript", { scriptId: script.id });
    closeModal();
  });
  modalRoot.querySelector('[data-modal-action="add-config"]').onclick = () => showConfigModal(script, null);
  modalRoot.querySelectorAll("[data-config-edit]").forEach(button => button.onclick = () => showConfigModal(script, script.configurations.find(c => c.id === button.dataset.configEdit)));
  modalRoot.querySelectorAll("[data-config-copy]").forEach(button => button.onclick = async () => { await call("duplicateConfiguration", { scriptId: script.id, configurationId: button.dataset.configCopy }); closeModal(); });
  modalRoot.querySelectorAll("[data-config-delete]").forEach(button => button.onclick = () => {
    const config = script.configurations.find(c => c.id === button.dataset.configDelete);
    confirmModal("Delete configuration", `Delete configuration "${config?.name || "Default"}"?`, async () => {
      await call("deleteConfiguration", { scriptId: script.id, configurationId: button.dataset.configDelete });
      closeModal();
    });
  });
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
      ${iconPicker("automation-icon", "account_tree")}
      ${colorPicker("automation-color", "#8083ff")}
    </div>
  `, async () => call("createAutomation", { name: value("automation-name"), description: value("automation-description"), groupId: value("automation-group"), icon: value("automation-icon"), color: value("automation-color") }));
  bindIconPicker("automation-icon");
  bindColorPicker("automation-color");
}

function showAutomationDetails(id) {
  const automation = ui.data.automations.find(item => item.id === id);
  const steps = [...(automation.steps || [])].sort((a,b) => a.order - b.order);
  modal("Automation Details", `
    ${modalAccent(automation.color)}
    <div class="form-grid">
      <input id="automation-edit-name" value="${escAttr(automation.name)}">
      <textarea id="automation-edit-description">${esc(automation.description || "")}</textarea>
      <select id="automation-edit-group">${ui.data.automationGroups.map(group => `<option value="${group.id}" ${group.id === automation.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
      ${iconPicker("automation-edit-icon", automation.icon || "account_tree")}
      ${colorPicker("automation-edit-color", automation.color || "#8083ff")}
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
  bindIconPicker("automation-edit-icon");
  bindColorPicker("automation-edit-color");
  modalRoot.querySelector('[data-auto-action="save"]').onclick = async () => { await call("updateAutomation", { automationId: automation.id, name: value("automation-edit-name"), description: value("automation-edit-description"), groupId: value("automation-edit-group"), icon: value("automation-edit-icon"), color: value("automation-edit-color") }); closeModal(); };
  modalRoot.querySelector('[data-auto-action="delete"]').onclick = () => {
    const phrase = `delete automation ${automation.name}`;
    phraseConfirm("Delete Automation", phrase, async () => {
      await call("deleteAutomation", { automationId: automation.id });
      closeModal();
    });
  };
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

function confirmModal(title, message, onConfirm) {
  modal(title, `<p class="meta">${esc(message)}</p>`, onConfirm);
}

function phraseConfirm(title, phrase, onConfirm) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar">
        <h2 class="modal-title">${esc(title)}</h2>
        <p class="meta">Type <strong>${esc(phrase)}</strong> to confirm.</p>
        <input id="phrase-confirm-input" placeholder="${escAttr(phrase)}">
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel</button>
          <button class="primary-button" data-phrase-confirm>Confirm</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  modalRoot.querySelector("[data-phrase-confirm]").onclick = async () => {
    if (value("phrase-confirm-input") !== phrase) {
      showError("Confirmation phrase does not match.");
      return;
    }
    try {
      await onConfirm();
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

function colorPicker(id, selected) {
  const color = colorValue(selected);
  return `
    <div class="form-grid">
      <label>Color</label>
      <div class="palette">${colorPalette.map(item => `<button type="button" class="swatch" style="--swatch-color:${escAttr(item)}" data-color-target="${id}" data-color="${escAttr(item)}" title="${escAttr(item)}"></button>`).join("")}</div>
      <input id="${id}" value="${escAttr(color)}" placeholder="#4fdbc8 or rgb(79, 219, 200)">
    </div>
  `;
}

function iconPicker(id, selected) {
  const current = selected || "code";
  return `
    <div class="form-grid">
      <label>Icon</label>
      <div class="icon-palette">${iconCatalog.map(item => `<button type="button" class="icon-choice" data-icon-target="${id}" data-icon-value="${escAttr(item)}" title="${escAttr(item)}">${icon(item)}</button>`).join("")}</div>
      <input id="${id}" value="${escAttr(current)}" placeholder="Material Symbol name">
    </div>
  `;
}

function bindIconPicker(id) {
  modalRoot.querySelectorAll(`[data-icon-target="${id}"]`).forEach(button => button.onclick = event => {
    event.preventDefault();
    document.getElementById(id).value = button.dataset.iconValue;
  });
}

function bindColorPicker(id) {
  modalRoot.querySelectorAll(`[data-color-target="${id}"]`).forEach(button => button.onclick = event => {
    event.preventDefault();
    document.getElementById(id).value = button.dataset.color;
  });
}

function modalAccent(color) {
  return `<div class="modal-accent" style="--item-color:${escAttr(colorValue(color))}"></div>`;
}

function colorValue(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text)) return text;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text);
  if (!rgb) return "#c0c1ff";
  return "#" + rgb.slice(1).map(part => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("");
}

function updateStatus(value) {
  const statusClass = value === "UPTODATE" ? "ok" : value === "OUTDATED" ? "warn" : "error";
  return `<span class="status-pill ${statusClass}">${esc(value || "NOINFO")}</span>`;
}

function icon(name) {
  if (brandIconLabels[name]) {
    return `<span class="brand-symbol" data-icon="${escAttr(name)}">${esc(brandIconLabels[name])}</span>`;
  }

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
    book_ribbon: "book_ribbon",
    history: "history",
    browse_activity: "browse_activity",
    play_arrow: "play_arrow",
    info: "info",
    save: "save",
    arrow_circle_up: "arrow_circle_up",
    edit_document: "edit_document",
    delete: "delete",
    edit: "edit",
    content_copy: "content_copy",
    download: "download",
    swap_vert: "swap_vert",
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

function findByName(items, name) { return (items || []).find(item => item.name === name); }
function value(id) { return document.getElementById(id)?.value || ""; }
function tail(text, length) { return text.length <= length ? text : text.slice(-length); }
function formatDate(value) { return value ? new Date(value).toLocaleString() : ""; }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
function escAttr(value) { return esc(value).replace(/`/g, "&#96;"); }

refresh().catch(error => showError(error.message));
