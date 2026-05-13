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
const logCleanupAlertElement = document.getElementById("log-cleanup-alert");
const colorPalette = ["#4fdbc8", "#c0c1ff", "#ffb783", "#f472b6", "#22c55e", "#38bdf8", "#facc15", "#fb7185", "#a78bfa", "#f97316"];
const pages = ["Scripts", "Automations", "Environment Variables", "Cheat Sheet", "Import & Backup", "Logs", "Settings"];
const defaultShortcuts = {
  pageScripts: "Ctrl+1",
  pageAutomations: "Ctrl+2",
  pageEnvironment: "Ctrl+3",
  pageCheatSheet: "Ctrl+4",
  pageImportBackup: "Ctrl+5",
  pageLogs: "Ctrl+6",
  pageSettings: "Ctrl+7",
  openDetails: "Enter",
  runFocused: "F5",
  focusSearch: "Ctrl+F",
  collapseGroups: "Alt+C",
  displayCards: "Alt+G",
  displayList: "Alt+L",
  newItem: "Ctrl+N",
  newGroup: "Ctrl+G",
  importScripts: "Ctrl+I",
  updateAll: "Ctrl+U",
  importBackup: "Ctrl+Shift+I",
  exportBackup: "Ctrl+Shift+E",
  openEnvironmentEditor: "Ctrl+Shift+V",
  saveSettings: "Ctrl+S",
  checkUpdates: "Ctrl+Shift+U",
  downloadUpdate: "Ctrl+Shift+D",
  resetShortcuts: "Ctrl+R",
  toggleTheme: "Ctrl+T",
  printNotes: "Ctrl+P",
  exportNotes: "Ctrl+E",
  deleteModalItem: "Del",
  saveModalItem: "Ctrl+Enter",
  addConfig: "Ctrl+C",
  closeModal: "Escape"
};
const shortcutMeta = [
  ["pageScripts", "Go to Scripts"],
  ["pageAutomations", "Go to Automation"],
  ["pageEnvironment", "Go to Environment Variables"],
  ["pageCheatSheet", "Go to Cheat Sheet"],
  ["pageImportBackup", "Go to Import & Backup"],
  ["pageLogs", "Go to Logs"],
  ["pageSettings", "Go to Settings"],
  ["openDetails", "Open focused details"],
  ["runFocused", "Run focused script/automation"],
  ["focusSearch", "Focus visible search"],
  ["collapseGroups", "Collapse/expand groups"],
  ["displayCards", "Show cards"],
  ["displayList", "Show list"],
  ["newItem", "Create item on current tab"],
  ["newGroup", "Create group on current tab"],
  ["importScripts", "Import scripts"],
  ["updateAll", "Update all scripts"],
  ["importBackup", "Import backup"],
  ["exportBackup", "Export backup"],
  ["openEnvironmentEditor", "Add/update environment variable"],
  ["saveSettings", "Save settings"],
  ["checkUpdates", "Check app version"],
  ["downloadUpdate", "Download update installer"],
  ["resetShortcuts", "Reset shortcuts"],
  ["toggleTheme", "Toggle theme"],
  ["printNotes", "Print notes"],
  ["exportNotes", "Export notes"],
  ["deleteModalItem", "Delete item in modal"],
  ["saveModalItem", "Confirm/save modal"],
  ["addConfig", "Add script configuration"],
  ["closeModal", "Close modal"]
];
// Google Material Symbols are free to use under the Apache License 2.0.
const iconCatalog = [
  "terminal_2", "terminal", "code", "code_blocks", "data_object", "integration_instructions", "developer_mode", "deployed_code", "play_arrow", "settings", "build", "construction", "handyman", "bolt", "rocket_launch", "account_tree", "schema", "hub", "lan", "cloud", "cloud_sync", "database", "storage", "dns", "folder", "folder_open", "inventory_2", "package_2", "book_ribbon", "article", "description", "fact_check", "task_alt", "check_circle", "warning", "error", "bug_report", "security", "lock", "key", "shield", "sync", "autorenew", "schedule", "timer", "memory", "speed", "monitoring", "analytics", "query_stats", "search", "edit", "edit_document", "delete", "download", "upload", "swap_vert", "box_add", "add_circle", "add_box", "coffee_maker", "perm_data_setting", "browse_activity", "history", "list_alt", "view_list", "grid_view", "terminal", "webhook", "route", "settings_suggest", "manufacturing", "precision_manufacturing", "rule", "rule_settings", "extension", "extension_off", "api", "token", "vpn_key", "encrypted", "lock_open", "backup", "restore", "archive", "unarchive", "file_copy", "content_copy", "file_save", "print"
];

const terminalColors = ["Black", "DarkBlue", "DarkGreen", "DarkCyan", "DarkRed", "DarkMagenta", "DarkYellow", "Gray", "DarkGray", "Blue", "Green", "Cyan", "Red", "Magenta", "Yellow", "White"];
const brandIconLabels = {};

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
  recentColors: loadRecentColors(),
  shortcuts: loadShortcuts(),
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
document.addEventListener("keydown", handleInitialTabFocus, true);
document.addEventListener("keydown", handleGlobalShortcut);
setInterval(updateLogCleanupStatus, 1000);

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
  renderLogCleanupStatus(ui.data.logCleanup);
}

async function updateLogCleanupStatus() {
  try {
    const status = await api("getLogCleanupStatus");
    renderLogCleanupStatus(status);
  } catch {
    // Cleanup status polling should never interrupt normal UI work.
  }
}

function renderLogCleanupStatus(status) {
  if (!logCleanupAlertElement) return;
  if (!status?.isRunning) {
    logCleanupAlertElement.hidden = true;
    logCleanupAlertElement.innerHTML = "";
    return;
  }
  logCleanupAlertElement.hidden = false;
  logCleanupAlertElement.innerHTML = `
    ${icon("autorenew")}
    <span>Cleaning logs</span>
    <strong>limit ${formatMb(status.limitMb)}</strong>
    <strong>current ${formatMb(status.currentMb)}</strong>
    <strong>target ${formatMb(status.targetMb)}</strong>
  `;
}

function render() {
  const searchFocus = captureSearchFocus();
  pageTitleElement.textContent = pageTitle();
  pageSubtitleElement.textContent = pageSubtitle();
  topActionsElement.innerHTML = toolbar();
  primaryActionsElement.innerHTML = pagePrimaryActions();
  pageContent.innerHTML = page();
  sidebarVersionElement.textContent = ui.data?.appVersion || "";
  searchShellElement.hidden = true;
  cheatSearchShellElement.hidden = true;
  document.querySelectorAll(".kbd").forEach(item => item.textContent = ui.shortcuts.focusSearch);
  document.querySelectorAll("[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === ui.page));
  applyShortcutLabels();
  bind();
  prepareInitialContentFocus();
  restoreSearchFocus(searchFocus);
}

function captureSearchFocus() {
  const element = document.activeElement;
  if (!element?.matches?.("[data-workspace-search]")) return null;
  return {
    id: element.id || "",
    kind: element.dataset.workspaceSearch || "",
    start: element.selectionStart,
    end: element.selectionEnd
  };
}

function restoreSearchFocus(state) {
  if (!state) return;
  const target = state.id
    ? document.getElementById(state.id)
    : document.querySelector(`[data-workspace-search="${state.kind}"]`);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (Number.isInteger(state.start) && Number.isInteger(state.end) && typeof target.setSelectionRange === "function") {
    const length = target.value.length;
    target.setSelectionRange(Math.min(state.start, length), Math.min(state.end, length));
  }
}

function toolbar() {
  return renderToolbarActions(toolbarActions());
}

function toolbarActions() {
  const viewActions = [
    { icon: "collapse_all", title: "Collapse Groups", action: "collapse", shortcut: "collapseGroups" },
    {
      group: [
        { icon: "grid_view", title: "Cards", action: "display-cards", active: ui.display === "cards", shortcut: "displayCards" },
        { icon: "view_list", title: "List", action: "display-list", active: ui.display === "list", shortcut: "displayList" }
      ]
    }
  ];
  if (ui.page === "Scripts") {
    return [
      ...viewActions,
      { icon: "autorenew", title: "Update all scripts", action: "update-all", shortcut: "updateAll" },
    ];
  }
  if (ui.page === "Automations") {
    return viewActions;
  }
  if (ui.page === "Cheat Sheet") {
    return [
      ...viewActions,
      { divider: true },
      { icon: "print", title: "Print notes", action: "print-cheat-sheet", shortcut: "printNotes" },
      { icon: "file_save", title: "Export notes", action: "export-cheat-sheet", shortcut: "exportNotes" }
    ];
  }
  if (ui.page === "Import & Backup") {
    return [
      { icon: "upload", title: "Import backup", action: "import-backup", shortcut: "importBackup" },
      { icon: "download", title: "Export backup", action: "export-backup", shortcut: "exportBackup" }
    ];
  }
  if (ui.page === "Environment Variables") {
    return [{ icon: "edit_document", title: "Add or update variable", action: "open-env-editor", shortcut: "openEnvironmentEditor" }];
  }
  if (ui.page === "Settings") {
    const themeIcon = ui.data?.settings?.theme === "Light" ? "dark_mode" : "light_mode";
    return [{ icon: themeIcon, title: "Toggle theme", action: "toggle-theme", shortcut: "toggleTheme" }];
  }
  return [];
}

function renderToolbarActions(items) {
  const actions = flattenToolbarItems(items);
  if (!actions.length) return "";
  const visible = items.map(item => {
    if (item.divider) return `<div class="divider-y responsive-action"></div>`;
    if (item.group) return `<div class="button-group responsive-action">${item.group.map(groupItem => tool(groupItem.icon, groupItem.title, groupItem.action, groupItem.active, "", groupItem.shortcut)).join("")}</div>`;
    return tool(item.icon, item.title, item.action, item.active, "responsive-action", item.shortcut);
  }).join("");
  const menu = actions.map(action => `
    <button class="overflow-menu-item" data-action="${action.action}">
      ${icon(action.icon)}
      <span>${esc(action.title)}</span>
      ${shortcutBadge(action.shortcut)}
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

function tool(iconName, title, action, active = false, extraClass = "", shortcut = null) {
  return `<button class="icon-button ${active ? "active" : ""} ${extraClass}" title="${title}" data-action="${action}">${icon(iconName)}${shortcutBadge(shortcut)}</button>`;
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
      ${workspaceSearch("scripts")}
      <button class="ghost-button" data-action="create-script-group">${icon("box_add")} New Group ${shortcutBadge("newGroup")}</button>
      <button class="ghost-button" data-action="import">${icon("attach_file_add")} Add Script ${shortcutBadge("importScripts")}</button>
      <button class="primary-button" data-action="create-script">${icon("add_circle")} Create New ${shortcutBadge("newItem")}</button>
    `;
  }
  if (ui.page === "Automations") {
    return `
      ${workspaceSearch("automations")}
      <button class="ghost-button" data-action="create-automation-group">${icon("box_add")} New Group ${shortcutBadge("newGroup")}</button>
      <button class="primary-button" data-action="create-automation">${icon("shutter_speed_add")} Create Automation ${shortcutBadge("newItem")}</button>
    `;
  }
  if (ui.page === "Cheat Sheet") {
    return `
      ${workspaceSearch("cheat")}
      <button class="ghost-button" data-action="create-cheat-group">${icon("box_add")} New Group ${shortcutBadge("newGroup")}</button>
      <button class="primary-button" data-action="create-cheat-entry">${icon("add_circle")} New Snippet ${shortcutBadge("newItem")}</button>
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

function workspaceSearch(kind) {
  if (kind === "cheat") {
    return `
      <div class="workspace-search cheat-workspace-search" data-first-focus>
        <select id="workspace-cheat-group" aria-label="Cheat Sheet group">
          <option value="all">All groups</option>
          ${(ui.data.cheatSheetGroups || []).map(group => `<option value="${group.id}" ${ui.cheatGroup === group.id ? "selected" : ""}>${esc(group.name)}</option>`).join("")}
        </select>
        <div class="search-shell compact">
          ${icon("search")}
          <input id="workspace-cheat-search" data-workspace-search="cheat" placeholder="Search snippets..." value="${escAttr(ui.cheatPendingSearch)}">
          <span class="kbd">${esc(ui.shortcuts.focusSearch)}</span>
        </div>
      </div>
    `;
  }

  const isAutomation = kind === "automations";
  return `
    <div class="workspace-search" data-first-focus>
      <div class="search-shell">
        ${icon("search")}
        <input data-workspace-search="${kind}" placeholder="${isAutomation ? "Search automation..." : "Search scripts..."}" value="${escAttr(isAutomation ? ui.automationSearch : ui.search)}">
        <span class="kbd">${esc(ui.shortcuts.focusSearch)}</span>
      </div>
    </div>
  `;
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
          ${record && groupType ? `<button class="icon-button" title="Edit group" data-group-edit="${record.id}" data-group-type="${groupType}">${icon("edit")}${shortcutBadge("openDetails")}</button>` : ""}
        </div>
        ${isCollapsed ? "" : renderItems(groupItems)}
      </section>
    `;
  }).join("");
}

function scriptCard(script) {
  return `
    <article class="script-card accented" tabindex="0" style="--item-color:${escAttr(colorValue(script.color))}" data-focus-type="script" data-focus-id="${script.id}" data-script-open="${script.id}">
      <div class="card-top">
        <div class="script-title"><span class="script-icon">${icon(script.icon || "terminal_2")}</span><span>${esc(script.name)}</span></div>
        ${status(script.status)}
      </div>
      <div class="meta">${esc(script.description || script.localPath || "")}</div>
      <div class="card-actions">
            <button class="primary-button" data-run-menu="${script.id}">${icon("play_arrow")} Run Script ${shortcutBadge("runFocused")}</button>
            <button class="ghost-button" data-script-open="${script.id}">${icon("info")} Details ${shortcutBadge("openDetails")}</button>
      </div>
    </article>
  `;
}

function scriptListRow(script) {
  return `
    <div class="list-row" tabindex="0" data-focus-type="script" data-focus-id="${script.id}">
      <div>
        <div class="script-title"><span class="script-icon">${icon(script.icon || "terminal_2")}</span><span>${esc(script.name)}</span></div>
        <div class="meta code-font">${esc(script.originalPath || script.localPath || "")}</div>
      </div>
      <div class="inline-actions">
        ${status(script.status)}
        <button class="icon-button" title="Details" data-script-open="${script.id}">${icon("info")}${shortcutBadge("openDetails")}</button>
        <button class="icon-button active" title="Run" data-run-menu="${script.id}">${icon("play_arrow")}${shortcutBadge("runFocused")}</button>
      </div>
    </div>
  `;
}

function automationsPage() {
  const query = ui.automationSearch.toLowerCase();
  const automations = (ui.data.automations || []).filter(automation => !query || [automation.name, automation.description, automation.group].some(x => (x || "").toLowerCase().includes(query)));
  if (!automations.length) return `<div class="panel">No automations yet. Create one and add script/configuration pairs.</div>`;
  return groupSections(automations, automation => automation.group || "Default", items => ui.display === "list"
    ? `<div class="common-list">${items.map(automationListRow).join("")}</div>`
    : `<div class="card-grid">${items.map(automationCard).join("")}</div>`,
    group => findByName(ui.data.automationGroups, group)?.color, group => findByName(ui.data.automationGroups, group), "automation");
}

function automationCard(automation) {
  return `
    <article class="automation-card accented" tabindex="0" style="--item-color:${escAttr(colorValue(automation.color))}" data-focus-type="automation" data-focus-id="${automation.id}">
      <div class="card-top">
        <div class="script-title"><span class="script-icon">${icon(automation.icon || "account_tree")}</span><span>${esc(automation.name)}</span></div>
        <span class="status-pill">${automation.steps?.length || 0} steps</span>
      </div>
      <div class="meta">${esc(automation.description || "No description")}</div>
      <div class="meta code-font">Modified ${formatDate(automation.lastModifiedAt)}</div>
      <div class="card-actions">
        <button class="primary-button" data-run-automation="${automation.id}">${icon("play_arrow")} Run ${shortcutBadge("runFocused")}</button>
        <button class="ghost-button" data-automation-open="${automation.id}">${icon("info")} Details ${shortcutBadge("openDetails")}</button>
      </div>
    </article>
  `;
}

function automationListRow(automation) {
  return `
    <div class="list-row" tabindex="0" data-focus-type="automation" data-focus-id="${automation.id}">
      <div>
        <div class="script-title"><span class="script-icon">${icon(automation.icon || "account_tree")}</span><span>${esc(automation.name)}</span></div>
        <div class="meta">${esc(automation.description || "No description")}</div>
        <div class="meta code-font">Modified ${formatDate(automation.lastModifiedAt)} · ${automation.steps?.length || 0} steps</div>
      </div>
      <div class="inline-actions">
        <button class="icon-button" title="Details" data-automation-open="${automation.id}">${icon("info")}${shortcutBadge("openDetails")}</button>
        <button class="icon-button active" title="Run" data-run-automation="${automation.id}">${icon("play_arrow")}${shortcutBadge("runFocused")}</button>
      </div>
    </div>
  `;
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
    const groupEntries = visibleEntries.filter(entry => entry.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || "").localeCompare(b.name || ""));
    if ((ui.cheatGroup !== "all" && ui.cheatGroup !== group.id) || !groupEntries.length && query) return "";
    const groupKey = group.name || group.id;
    const isCollapsed = ui.collapsed.has(groupKey);
    return `
      <section>
        <div class="section-header">
          <div class="section-toggle" data-collapse="${escAttr(groupKey)}" style="color:${escAttr(colorValue(group.color))}">${icon(isCollapsed ? "chevron_right" : "expand_more")} ${icon(group.icon || "book_ribbon")} ${esc(group.name)} (${groupEntries.length})</div>
          <button class="icon-button" title="Edit group" data-cheat-group-open="${group.id}">${icon("edit")}${shortcutBadge("openDetails")}</button>
        </div>
        ${isCollapsed ? "" : `
          <div class="${ui.display === "cards" ? "card-grid" : "cheat-list"}" data-cheat-group-list="${group.id}">
            ${groupEntries.map((entry, index) => ui.display === "cards" ? cheatEntryCard(entry, index) : cheatEntryRow(entry, index)).join("") || `<div class="panel">No snippets in this group.</div>`}
          </div>
        `}
      </section>
    `;
  }).join("");
}

function cheatEntryCard(entry, displayOrder) {
  const preview = codePreview(entry.code || "");
  return `
    <article class="script-card accented" tabindex="0" style="--item-color:${escAttr(colorValue(entry.color))}" data-focus-type="cheat" data-focus-id="${entry.id}">
      <div class="card-top">
        <div class="script-title"><span>${esc(entry.name || "Untitled snippet")}</span></div>
        <button class="icon-button" title="Edit" data-cheat-entry-open="${entry.id}">${icon("edit")}${shortcutBadge("openDetails")}</button>
      </div>
      <div class="meta">${esc(entry.description || "")}</div>
      <pre class="cheat-code-preview ${preview.truncated ? "truncated" : ""}">${esc(preview.text || "(empty)")}</pre>
    </article>
  `;
}

function cheatEntryRow(entry, displayOrder) {
  const preview = codePreview(entry.code || "");
  return `
    <article class="cheat-row accented" tabindex="0" style="--item-color:${escAttr(colorValue(entry.color))}" draggable="true" data-focus-type="cheat" data-focus-id="${entry.id}" data-cheat-entry-row="${entry.id}" data-cheat-group-id="${entry.groupId}">
      <div class="cheat-row-head">
        <div class="cheat-row-title">
          <strong>${esc(entry.name || "Untitled snippet")}</strong>
          <span>${esc(entry.description || "")}</span>
        </div>
        <button class="icon-button" title="Edit" data-cheat-entry-open="${entry.id}">${icon("edit")}${shortcutBadge("openDetails")}</button>
      </div>
      <div class="cheat-row-body">
        <span class="drag-handle cheat-drag" title="Drag to reorder">${icon("drag_handle")}</span>
        <pre class="cheat-code-preview ${preview.truncated ? "truncated" : ""}">${esc(preview.text || "(empty)")}</pre>
      </div>
    </article>
  `;
}

function codePreview(code) {
  const lines = String(code || "").split(/\r?\n/);
  return {
    text: lines.slice(0, 4).join("\n"),
    truncated: lines.length > 4
  };
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
          <button class="primary-button" data-action="export-backup">${icon("download")} Export Backup ${shortcutBadge("exportBackup")}</button>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Import</h2>
        <p class="meta">Imports a ScriptManager backup ZIP. Existing objects with the same IDs are updated; missing objects are added.</p>
        <div class="backup-actions">
          <button class="ghost-button" data-action="import-backup">${icon("upload")} Import Backup ${shortcutBadge("importBackup")}</button>
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
          <select id="default-terminal">${["pwsh", "powershell", "wt", "cmd"].map(x => `<option ${x !== "pwsh" ? "disabled" : ""} ${x === "pwsh" ? "selected" : ""}>${x}</option>`).join("")}</select>
          <label><input id="open-terminal" type="checkbox" ${settings.openTerminalWindow ? "checked" : ""}> Open terminal window when supported</label>
          <label><input id="stop-on-failure" type="checkbox" ${settings.stopAutomationOnFailure ? "checked" : ""}> Stop automation on first failure</label>
          <p class="meta">Success detection is process-based: exit code 0 is success, non-zero or thrown errors are failure. Domain failures should return non-zero.</p>
          <button class="primary-button" data-action="save-settings">${icon("save")} Save Settings ${shortcutBadge("saveSettings")}</button>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Run Behavior</h2>
        <div class="form-grid">
          <label><input id="auto-close-terminal" type="checkbox" ${settings.autoCloseTerminalAfterRun !== false ? "checked" : ""}> Automatically close terminal after run</label>
          <label>Terminal close delay after run (seconds)</label>
          <input id="terminal-close-delay" type="number" min="0" max="3600" step="1" value="${Number.isFinite(settings.terminalCloseDelaySeconds) ? settings.terminalCloseDelaySeconds : 30}">
          <label><input id="show-output-after-run" type="checkbox" ${settings.showOutputAfterRun !== false ? "checked" : ""}> Show output after run</label>
          <label><input id="should-wait-between-scripts" type="checkbox" ${settings.shouldWaitBetweenScripts ? "checked" : ""}> Wait between automation scripts</label>
          <label>Wait between scripts (milliseconds)</label>
          <input id="wait-between-scripts" class="number-spaced-input" inputmode="numeric" value="${formatNumberSpaces(settings.waitBetweenScriptsMilliseconds || 1000)}">
          <label><input id="confirmation-between-scripts" type="checkbox" ${settings.confirmationBetweenScripts ? "checked" : ""}> Ask for confirmation between automation scripts</label>
          <p class="meta">When output preview is disabled, ScriptManager shows only a floating run summary and leaves you on the current tab.</p>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Default Values</h2>
        <div class="form-grid">
          <label>Default delay for automation Delay action (milliseconds)</label>
          <input id="default-delay" class="number-spaced-input" inputmode="numeric" value="${formatNumberSpaces(settings.defaultDelay || 1000)}">
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Log Storage</h2>
        <div class="form-grid">
          <label>Log directory</label>
          <div class="path-picker-row">
            <input id="log-directory" value="${escAttr(settings.logDirectory || "")}" placeholder="Default app logs directory">
            <button class="ghost-button" data-action="choose-log-directory">${icon("folder_open")} Browse</button>
          </div>
          <label>Maximum log folder size (MB)</label>
          <input id="max-log-folder-size" type="number" min="1" step="1" value="${Number.isFinite(settings.maxLogFolderSizeMb) ? settings.maxLogFolderSizeMb : 100}">
          <p class="meta">On shutdown ScriptManager cleans logs above the limit down to 90%. On startup it cleans only if the folder is above 110% of the limit.</p>
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
          <button class="ghost-button" data-action="check-updates">${icon("autorenew")} Check Version ${shortcutBadge("checkUpdates")}</button>
          ${update.status === "OUTDATED" ? `<button class="primary-button" data-action="download-update">${icon("download")} Download Installer ${shortcutBadge("downloadUpdate")}</button>` : ""}
        </div>
      </section>
      <section class="panel shortcuts-card">
        <h2 class="panel-title">Keyboard Shortcuts</h2>
        <p class="meta">Click a shortcut field and press the new key combination. Names do not need to be unique, but shortcut conflicts will use the first matching action.</p>
        <div class="shortcut-grid">
          ${shortcutMeta.map(([key, label]) => `
            <label class="shortcut-row">
              <span>${esc(label)}</span>
              <input data-shortcut-input="${key}" value="${escAttr(ui.shortcuts[key] || "")}" readonly>
            </label>
          `).join("")}
        </div>
        <div class="inline-actions">
          <button class="ghost-button" data-action="reset-shortcuts">${icon("restart_alt")} Reset Shortcuts ${shortcutBadge("resetShortcuts")}</button>
        </div>
      </section>
    </div>
  `;
}

function environmentPage() {
  const env = ui.data.environmentVariables || [];
  return `
    <section class="panel environment-panel">
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
  document.querySelectorAll("[data-workspace-search]").forEach(input => input.oninput = event => {
    if (input.dataset.workspaceSearch === "automations") ui.automationSearch = event.target.value;
    else if (input.dataset.workspaceSearch === "cheat") {
      ui.cheatPendingSearch = event.target.value;
      clearTimeout(ui.cheatSearchTimer);
      ui.cheatSearchTimer = setTimeout(() => {
        ui.cheatSearch = ui.cheatPendingSearch;
        render();
      }, 1000);
      return;
    }
    else ui.search = event.target.value;
    render();
  });
  document.querySelector("#workspace-cheat-group")?.addEventListener("change", event => {
    ui.cheatGroup = event.target.value;
    render();
  });
  bindShortcutInputs();
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
  document.querySelectorAll(".number-spaced-input").forEach(input => {
    input.oninput = () => {
      const caretFromEnd = input.value.length - input.selectionStart;
      input.value = formatNumberSpaces(parseSpacedInteger(input.value));
      const nextCaret = Math.max(0, input.value.length - caretFromEnd);
      input.setSelectionRange(nextCaret, nextCaret);
    };
    input.onblur = () => {
      input.value = formatNumberSpaces(Math.max(1, parseSpacedInteger(input.value) || 1000));
    };
  });
  document.querySelectorAll("[data-collapse]").forEach(button => button.onclick = () => toggleCollapse(button.dataset.collapse));
  document.querySelectorAll("[data-run-menu]").forEach(button => button.onclick = () => showRunMenu(button.dataset.runMenu));
  document.querySelectorAll("[data-run-script]").forEach(button => button.onclick = () => runScript(button.dataset.runScript, button.dataset.config || ""));
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
  document.querySelectorAll("[data-focus-type]").forEach(item => item.onclick = event => {
    if (event.target.closest("button, a, input, select, textarea, [data-collapse], [draggable='true'] .drag-handle")) return;
    openItemDetails(item.dataset.focusType, item.dataset.focusId);
  });
  bindCheatEntryDrag();
}

function bindShortcutInputs() {
  document.querySelectorAll("[data-shortcut-input]").forEach(input => {
    input.onkeydown = event => {
      event.preventDefault();
      const combo = eventToShortcut(event);
      if (!combo) return;
      ui.shortcuts[input.dataset.shortcutInput] = combo;
      input.value = combo;
      saveShortcuts();
      render();
    };
  });
}

function prepareInitialContentFocus(root = document) {
  const scope = root === document ? pageContent.parentElement : root.querySelector?.(".modal") || root;
  const first = scope.querySelector("[data-first-focus] input, [data-first-focus] select, [data-first-focus] button, [data-first-focus], input:not([type='hidden']), select, textarea, button:not([tabindex='-1']), [tabindex]:not([tabindex='-1'])");
  if (!first) return;
  scope.dataset.initialFocusSelector = "ready";
}

function handleInitialTabFocus(event) {
  if (event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  const modal = modalRoot.querySelector(".modal");
  const container = modal || pageContent.parentElement;
  if (!container?.dataset.initialFocusSelector) return;
  if (container.contains(document.activeElement) && document.activeElement !== document.body) return;
  const first = container.querySelector("[data-first-focus] input, [data-first-focus] select, [data-first-focus] button, [data-first-focus], input:not([type='hidden']), select, textarea, button:not([tabindex='-1']), [tabindex]:not([tabindex='-1'])");
  if (!first) return;
  event.preventDefault();
  first.focus();
  delete container.dataset.initialFocusSelector;
}

function handleGlobalShortcut(event) {
  if (event.defaultPrevented || document.querySelector("[data-shortcut-input]:focus")) return;
  const combo = eventToShortcut(event);
  if (!combo) return;
  const key = Object.entries(ui.shortcuts).find(([, value]) => value === combo)?.[0];
  if (!key) return;
  if (modalRoot.innerHTML && handleModalShortcut(key, event)) return;
  if (modalRoot.innerHTML && key !== "closeModal") return;
  if (isTypingTarget(event.target) && !["closeModal"].includes(key)) return;
  if (key === "openDetails" && event.target.closest?.("button")) return;
  event.preventDefault();
  runShortcut(key);
}

function handleModalShortcut(key, event) {
  const modal = event.target.closest?.(".modal") || modalRoot.querySelector(".modal");
  if (!modal) return false;
  if (key === "closeModal") {
    event.preventDefault();
    if (closeOpenColorPopovers()) return true;
    closeModal();
    return true;
  }
  if (key === "saveModalItem") {
    event.preventDefault();
    const confirmButton = modalRoot.querySelector('[data-modal-action="save-script"], [data-modal-confirm], [data-cheat-entry-save], [data-phrase-confirm], [data-auto-action="save"], [data-confirm-run]');
    if (confirmButton && !confirmButton.closest("[hidden]")) {
      confirmButton.click();
      return true;
    }
    return false;
  }
  if (!modal.dataset.scriptDetails) return false;
  if (key === "deleteModalItem" && !isTypingTarget(event.target)) {
    event.preventDefault();
    modalRoot.querySelector('[data-modal-action="delete-script"]')?.click();
    return true;
  }
  if (key === "addConfig") {
    event.preventDefault();
    modalRoot.querySelector('[data-modal-action="add-config"]')?.click();
    return true;
  }
  return false;
}

function closeOpenColorPopovers() {
  const openPanels = [...modalRoot.querySelectorAll("[data-color-custom-panel]")].filter(panel => !panel.hidden);
  openPanels.forEach(panel => panel.hidden = true);
  return openPanels.length > 0;
}

function runShortcut(key) {
  const pageMap = {
    pageScripts: "Scripts",
    pageAutomations: "Automations",
    pageEnvironment: "Environment Variables",
    pageCheatSheet: "Cheat Sheet",
    pageImportBackup: "Import & Backup",
    pageLogs: "Logs",
    pageSettings: "Settings"
  };
  if (pageMap[key]) {
    ui.page = pageMap[key];
    render();
    return;
  }
  if (key === "openDetails") return openFocusedDetails();
  if (key === "runFocused") return runFocusedItem();
  if (key === "focusSearch") return focusVisibleSearch();
  if (key === "collapseGroups") return handleAction("collapse");
  if (key === "displayCards") return handleAction("display-cards");
  if (key === "displayList") return handleAction("display-list");
  if (key === "newItem") return runPageAction(ui.page === "Scripts" ? "create-script" : ui.page === "Automations" ? "create-automation" : ui.page === "Cheat Sheet" ? "create-cheat-entry" : "");
  if (key === "newGroup") return runPageAction(ui.page === "Scripts" ? "create-script-group" : ui.page === "Automations" ? "create-automation-group" : ui.page === "Cheat Sheet" ? "create-cheat-group" : "");
  if (key === "importScripts" && ui.page === "Scripts") return handleAction("import");
  if (key === "updateAll" && ui.page === "Scripts") return handleAction("update-all");
  if (key === "importBackup" && ui.page === "Import & Backup") return handleAction("import-backup");
  if (key === "exportBackup" && ui.page === "Import & Backup") return handleAction("export-backup");
  if (key === "openEnvironmentEditor" && ui.page === "Environment Variables") return handleAction("open-env-editor");
  if (key === "saveSettings" && ui.page === "Settings") return handleAction("save-settings");
  if (key === "checkUpdates" && ui.page === "Settings") return handleAction("check-updates");
  if (key === "downloadUpdate" && ui.page === "Settings") return handleAction("download-update");
  if (key === "resetShortcuts" && ui.page === "Settings") return handleAction("reset-shortcuts");
  if (key === "toggleTheme") return handleAction("toggle-theme");
  if (key === "printNotes" && ui.page === "Cheat Sheet") return handleAction("print-cheat-sheet");
  if (key === "exportNotes" && ui.page === "Cheat Sheet") return handleAction("export-cheat-sheet");
  if (key === "closeModal" && modalRoot.innerHTML) return closeModal();
}

function runPageAction(action) {
  if (action) return handleAction(action);
}

function openFocusedDetails() {
  const target = document.activeElement?.closest?.("[data-focus-type]");
  if (!target) return;
  return openItemDetails(target.dataset.focusType, target.dataset.focusId);
}

function openItemDetails(type, id) {
  if (type === "script") return showScriptDetails(id);
  if (type === "automation") return showAutomationDetails(id);
  if (type === "cheat") return showCheatEntryModal(ui.data.cheatSheetEntries.find(entry => entry.id === id));
}

function runFocusedItem() {
  const target = document.activeElement?.closest?.("[data-focus-type]");
  if (!target) return;
  if (target.dataset.focusType === "automation") return runAutomation(target.dataset.focusId);
  if (target.dataset.focusType === "script") {
    const script = ui.data.scripts.find(item => item.id === target.dataset.focusId);
    return runScript(script.id, "");
  }
}

function focusVisibleSearch() {
  if (ui.page === "Cheat Sheet") return document.getElementById("workspace-cheat-search")?.focus();
  if (ui.page === "Scripts" || ui.page === "Automations") return document.querySelector("[data-workspace-search]")?.focus();
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
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
    if (action === "print-cheat-sheet") return showCheatSheetPrintModal();
    if (action === "export-cheat-sheet") return showCheatSheetExportModal();
    if (action === "toggle-theme") return await call("saveSettings", { ...ui.data.settings, theme: ui.data.settings.theme === "Light" ? "Dark" : "Light" });
    if (action === "reset-shortcuts") { ui.shortcuts = { ...defaultShortcuts }; saveShortcuts(); render(); return; }
    if (action === "save-settings") return await saveSettings();
    if (action === "choose-log-directory") {
      const result = await api("chooseLogDirectory");
      if (result?.path) document.getElementById("log-directory").value = result.path;
      return;
    }
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
  const groups = currentPageGroupKeys();
  if (!groups.length) return;
  const allCollapsed = groups.every(group => ui.collapsed.has(group));
  groups.forEach(group => allCollapsed ? ui.collapsed.delete(group) : ui.collapsed.add(group));
  render();
}

function currentPageGroupKeys() {
  if (ui.page === "Scripts") return [...new Set((ui.data.scripts || []).map(script => script.group || "Default"))];
  if (ui.page === "Automations") return [...new Set((ui.data.automations || []).map(automation => automation.group || "Default"))];
  if (ui.page === "Cheat Sheet") return (ui.data.cheatSheetGroups || [])
    .filter(group => ui.cheatGroup === "all" || ui.cheatGroup === group.id)
    .map(group => group.name || group.id);
  return [];
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
  return ui.data;
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
      <select id="script-extension"><option>.ps1</option><option disabled>.cmd</option><option disabled>.bat</option><option disabled>.sh</option><option disabled>.py</option><option disabled>.js</option><option disabled>.sql</option></select>
      <textarea id="script-content" class="terminal-box" placeholder="Write commands line by line"></textarea>
      <div class="divider"></div>
      ${iconPicker("script-icon", "terminal_2")}
      ${colorPicker("script-color", "#c0c1ff")}
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
      <div class="divider"></div>
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
      <button class="ghost-button" data-delete-group="${group.id}">${icon("delete")} Delete Group</button>
      <div class="divider"></div>
      ${colorPicker("edit-group-color", group.color || (isAutomation ? "#ffb783" : "#4fdbc8"))}
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
      ${isEdit ? `<button class="ghost-button" data-delete-cheat-group="${group.id}">${icon("delete")} Delete Group</button>` : ""}
      <div class="divider"></div>
      ${iconPicker("cheat-group-icon", group?.icon || "book_ribbon")}
      ${colorPicker("cheat-group-color", group?.color || "#4fdbc8")}
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
  const selectedGroupId = entry?.groupId || (ui.cheatGroup !== "all" ? ui.cheatGroup : groups[0]?.id || "__default__");
  const isEdit = Boolean(entry);
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar cheat-entry-modal">
        ${modalAccent(entry?.color)}
        <button class="modal-close" title="Close" tabindex="-1" data-modal-close>${icon("close")}</button>
        <header class="cheat-entry-modal-header">
          <h2 class="modal-title">${isEdit ? "Edit Cheat Sheet Snippet" : "New Cheat Sheet Snippet"}</h2>
          <select id="cheat-entry-group" class="cheat-entry-group-select">
            ${groups.length ? groups.map(group => `<option value="${group.id}" ${group.id === selectedGroupId ? "selected" : ""}>${esc(group.name)}</option>`).join("") : `<option value="__default__" selected>default group</option>`}
          </select>
        </header>
        <div class="form-grid">
          <input id="cheat-entry-name" placeholder="Name" value="${escAttr(entry?.name || "")}">
          <div id="cheat-entry-name-hint" class="duplicate-hint" hidden></div>
          <textarea id="cheat-entry-code" class="cheat-code-input" placeholder="Code" required>${esc(entry?.code || "")}</textarea>
          <div class="soft-divider"></div>
          <details class="optional-description" ${entry?.description ? "open" : ""}>
            <summary>Description <span>optional</span></summary>
            <textarea id="cheat-entry-description" placeholder="Description">${esc(entry?.description || "")}</textarea>
          </details>
          ${isEdit ? `<button class="ghost-button" data-delete-cheat-entry="${entry.id}">${icon("delete")} Delete Snippet</button>` : ""}
          <div class="divider"></div>
          ${colorPicker("cheat-entry-color", entry?.color || "#c0c1ff")}
        </div>
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          <button class="primary-button" data-cheat-entry-save>Confirm ${shortcutBadge("saveModalItem")}</button>
        </div>
      </div>
    </div>
  `;
  bindColorPicker("cheat-entry-color");
  bindCheatEntryNameHint(entry);
  modalRoot.querySelectorAll("[data-modal-close]").forEach(button => button.onclick = closeModal);
  prepareInitialContentFocus(modalRoot);
  modalRoot.querySelector("[data-cheat-entry-save]").onclick = async () => {
    if (!value("cheat-entry-code").trim()) {
      showError("Code is required.");
      return;
    }

    await call("saveCheatSheetEntry", { entryId: entry?.id || "", groupId: value("cheat-entry-group"), name: value("cheat-entry-name"), description: value("cheat-entry-description"), code: value("cheat-entry-code"), color: value("cheat-entry-color") });
    closeModal();
  };
  const deleteButton = modalRoot.querySelector("[data-delete-cheat-entry]");
  if (deleteButton) deleteButton.onclick = async event => {
    event.preventDefault();
    confirmModal("Delete snippet", `Delete Cheat Sheet snippet "${entry.name || "Untitled snippet"}"?`, async () => {
      await call("deleteCheatSheetEntry", { entryId: entry.id });
      closeModal();
    });
  };
}

function bindCheatEntryNameHint(entry) {
  const input = document.getElementById("cheat-entry-name");
  const groupSelect = document.getElementById("cheat-entry-group");
  const hint = document.getElementById("cheat-entry-name-hint");
  let timer = null;
  const check = () => {
    const name = input.value.trim().toLowerCase();
    hint.hidden = true;
    hint.textContent = "";
    hint.className = "duplicate-hint";
    if (!name) return;
    const matches = (ui.data.cheatSheetEntries || []).filter(item => item.id !== entry?.id && (item.name || "").trim().toLowerCase() === name);
    if (!matches.length) return;
    const sameGroup = matches.some(item => item.groupId === groupSelect.value);
    hint.classList.add(sameGroup ? "danger" : "warn");
    hint.textContent = sameGroup
      ? "Hint only: another note in this group has the same name. The app accepts duplicate names; only note GUID IDs are unique."
      : "Hint only: another note in a different group has the same name. The app accepts duplicate names; only note GUID IDs are unique.";
    hint.hidden = false;
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(check, 1000);
  });
  input.addEventListener("blur", check);
  groupSelect.addEventListener("change", check);
}

function showCheatSheetPrintModal() {
  const groups = ui.data.cheatSheetGroups || [];
  if (!groups.length) {
    showError("No Cheat Sheet groups to print.");
    return;
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar compact-modal">
        <h2 class="modal-title">Print Notes</h2>
        <div class="check-list">
          <label class="check-row">
            <input id="cheat-print-all" type="checkbox" checked>
            <span>All groups</span>
          </label>
          <div class="divider"></div>
          ${groups.map(group => `
            <label class="check-row">
              <input class="cheat-print-group" type="checkbox" value="${escAttr(group.id)}" checked>
              <span class="group-dot" style="--item-color:${escAttr(colorValue(group.color))}"></span>
              <span>${esc(group.name)}</span>
            </label>
          `).join("")}
        </div>
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          <button class="primary-button" data-cheat-print-confirm>${icon("print")} Print</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  prepareInitialContentFocus(modalRoot);
  const all = modalRoot.querySelector("#cheat-print-all");
  const boxes = [...modalRoot.querySelectorAll(".cheat-print-group")];
  all.onchange = () => boxes.forEach(box => box.checked = all.checked);
  boxes.forEach(box => box.onchange = () => {
    all.checked = boxes.every(item => item.checked);
    all.indeterminate = boxes.some(item => item.checked) && !all.checked;
  });
  modalRoot.querySelector("[data-cheat-print-confirm]").onclick = async () => {
    const groupIds = boxes.filter(box => box.checked).map(box => box.value);
    if (!groupIds.length) {
      showError("Select at least one group to print.");
      return;
    }

    closeModal();
    await call("printCheatSheet", { groupIds });
  };
}

function showCheatSheetExportModal() {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal compact-modal">
        <h2 class="modal-title">Export Notes</h2>
        <div class="form-grid">
          <label for="cheat-export-format">Format</label>
          <select id="cheat-export-format">
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
            <option value="txt">TXT</option>
            <option value="txt-json">TXT (JSON)</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          <button class="primary-button" data-cheat-export-confirm>${icon("file_save")} Export</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  prepareInitialContentFocus(modalRoot);
  modalRoot.querySelector("[data-cheat-export-confirm]").onclick = async () => {
    const format = value("cheat-export-format");
    closeModal();
    await call("exportCheatSheet", { format });
  };
}

async function showScriptDetails(id) {
  const script = ui.data.scripts.find(item => item.id === id);
  const code = await api("getScriptCode", { scriptId: id });
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar script-details-modal" data-script-details="true" style="--item-color:${escAttr(colorValue(script.color))}">
        ${modalAccent(script.color)}
        <button class="modal-close" title="Close" tabindex="-1" data-modal-close>${icon("close")}</button>
        <header class="script-details-header">
          <h2 class="modal-title">Script Details</h2>
          <div class="script-details-header-actions">
            <select id="edit-script-group" class="script-details-group-select" aria-label="Script group">
              ${ui.data.scriptGroups.map(group => `<option value="${group.id}" ${group.id === script.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}
            </select>
            <button class="icon-button danger-icon-button" title="Delete" data-modal-action="delete-script">${icon("delete")}${shortcutBadge("deleteModalItem")}</button>
          </div>
        </header>
        <div class="form-grid script-details-form">
          <input id="edit-script-name" data-first-focus value="${escAttr(script.name)}" placeholder="Name">
          <div>
            <div class="meta code-font">${esc(script.originalPath || "Local script created in app")}</div>
            <div class="terminal-box script-code-preview">${esc(code)}</div>
          </div>
          <section class="script-config-section">
            <div class="steps-card-header">
              <div>
                <h3>Configurations</h3>
                <div class="meta">${(script.configurations || []).length} item${(script.configurations || []).length === 1 ? "" : "s"}</div>
              </div>
              <button class="ghost-button" data-modal-action="add-config">${icon("add")} Config ${shortcutBadge("addConfig")}</button>
            </div>
            <div class="common-list">${[...(script.configurations || [])].sort((a,b) => a.order - b.order).map(configItem).join("") || `<div class="meta">No configurations yet.</div>`}</div>
          </section>
          <div class="divider script-details-divider"></div>
          <details class="optional-description" ${script.description ? "open" : ""}>
            <summary>Description <span>optional</span></summary>
            <textarea id="edit-script-description" placeholder="Description">${esc(script.description || "")}</textarea>
          </details>
          ${iconPicker("edit-script-icon", script.icon || "terminal_2")}
          ${colorPicker("edit-script-color", script.color || "#c0c1ff")}
        </div>
        <footer class="script-details-footer">
          <button class="primary-button" data-modal-action="save-script">${icon("save")} Save ${shortcutBadge("saveModalItem")}</button>
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
        </footer>
      </div>
    </div>
  `;
  modalRoot.querySelectorAll("[data-modal-close]").forEach(button => button.onclick = closeModal);
  prepareInitialContentFocus(modalRoot);
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
  modalRoot.querySelectorAll("[data-config-run]").forEach(button => button.onclick = async () => { await runScript(script.id, button.dataset.configRun); });
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
      <input id="cfg-working" placeholder="Working directory" value="${escAttr(config?.workingDirectory || "")}">
      <textarea id="cfg-params" placeholder="One parameter per line: name=value">${esc(formatParameters(config?.parameters || []))}</textarea>
      <label class="config-admin-row"><input id="cfg-admin" type="checkbox" ${config?.runAsAdmin ? "checked" : ""}> <span>Run as administrator</span></label>
    </div>
  `, async () => {
    const runAsAdmin = document.getElementById("cfg-admin").checked;
    if (runAsAdmin && !config?.runAsAdmin && !confirm("This configuration may elevate privileges. Confirm that you trust this script and parameters.")) return;
    await call("saveConfiguration", {
      scriptId: script.id,
      configuration: {
        id: config?.id || "",
        name: value("cfg-name"),
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
  const configurations = [...(script.configurations || [])].sort((a,b) => a.order - b.order);
  if (!configurations.length) {
    runScript(scriptId, "");
    return;
  }
  modal("Run Script", `<div class="common-list">${configurations.map(config => `
    <div class="config-item">
      <span></span>
      <button class="ghost-button" style="justify-content:flex-start" data-run-config="${config.id}">${esc(config.name)}</button>
      <button class="icon-button" title="Info" data-info-config="${config.id}">${icon("info")}</button>
    </div>
  `).join("")}</div>`);
  modalRoot.querySelectorAll("[data-run-config]").forEach(button => button.onclick = async () => { await runScript(scriptId, button.dataset.runConfig); });
  modalRoot.querySelectorAll("[data-info-config]").forEach(button => button.onclick = () => showConfigInfo(script, script.configurations.find(c => c.id === button.dataset.infoConfig)));
}

function showConfigInfo(script, config) {
  modal("Configuration Details", `
    <div class="form-grid">
      <div class="script-title">${esc(config.name)}</div>
      <div class="meta">Script: ${esc(script.name)}</div>
      <div class="meta code-font">Working directory: ${esc(config.workingDirectory || "")}</div>
      <div class="terminal-box">${esc(formatParameters(config.parameters || []) || "No parameters")}</div>
      <button class="ghost-button" data-edit-config="${config.id}">${icon("edit")} Edit</button>
    </div>
  `);
  modalRoot.querySelector("[data-edit-config]").onclick = () => showConfigModal(script, config);
}

async function runScript(scriptId, configurationId) {
  const script = ui.data.scripts.find(item => item.id === scriptId);
  const configurations = [...(script?.configurations || [])].sort((a, b) => a.order - b.order);
  if (!configurationId && configurations.length) {
    showRunMenu(scriptId);
    return;
  }
  await showRunConfirmation({
    title: `Run ${script?.name || "script"}`,
    prepareAction: "prepareRunScript",
    runAction: "runScript",
    payload: { scriptId, configurationId: configurationId || "" },
    onDone: () => { ui.page = "Logs"; }
  });
}

async function showRunConfirmation({ title, prepareAction, runAction, payload, forceShowOutput = false, onDone }) {
  const preview = await api(prepareAction, payload);
  const commands = preview.commands || [];
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal terminal-confirm-modal custom-scrollbar">
        <button class="modal-close" data-modal-close type="button">${icon("close")}</button>
        <h2 class="modal-title">${icon("terminal_2")} ${esc(title)}</h2>
        <p class="meta">Review the exact command set before ScriptManager opens a visible terminal.</p>
        <div class="terminal-command-list">
          ${commands.map((command, index) => `
            <section class="terminal-command">
              <div class="terminal-command-meta">${index + 1}. ${esc(command.scriptName)} / ${esc(command.configurationName || "Ad hoc")}</div>
              <div class="terminal-command-path">${esc(command.workingDirectory || "Current directory")}</div>
              <pre>${esc(command.commandLine)}</pre>
            </section>
          `).join("") || `<section class="terminal-command"><pre>No commands prepared.</pre></section>`}
        </div>
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          <button class="primary-button" data-confirm-run>${icon("play_arrow")} Run in Terminal ${shortcutBadge("saveModalItem")}</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelectorAll("[data-modal-close]").forEach(button => button.onclick = closeModal);
  modalRoot.querySelector("[data-confirm-run]").onclick = async () => {
    const resultState = await call(runAction, payload);
    const lastRun = resultState.lastRun;
    closeModal();
    if ((forceShowOutput || ui.data.settings?.showOutputAfterRun !== false) && lastRun?.id) {
      if (onDone) onDone();
      render();
      showLog(lastRun.id);
      return;
    }
    showRunToast(lastRun);
  };
}

function showCreateAutomationModal() {
  modal("Create Automation", `
    <div class="form-grid">
      <input id="automation-name" placeholder="Automation name">
      <textarea id="automation-description" placeholder="Description"></textarea>
      <select id="automation-group">${ui.data.automationGroups.map(group => `<option value="${group.id}">${esc(group.name)}</option>`).join("")}</select>
      <label><input id="automation-run-admin" type="checkbox"> Run as administrator</label>
      <label><input id="automation-show-output" type="checkbox"> Show output after run</label>
      <label><input id="automation-try-continue" type="checkbox"> Try continue even if fail</label>
      <div class="divider"></div>
      ${iconPicker("automation-icon", "account_tree")}
      ${colorPicker("automation-color", "#8083ff")}
    </div>
  `, async () => call("createAutomation", { name: value("automation-name"), description: value("automation-description"), groupId: value("automation-group"), runAsAdmin: document.getElementById("automation-run-admin").checked, showOutputAfterRun: document.getElementById("automation-show-output").checked, tryContinueEvenIfFail: document.getElementById("automation-try-continue").checked, icon: value("automation-icon"), color: value("automation-color") }));
  bindIconPicker("automation-icon");
  bindColorPicker("automation-color");
}

function showAutomationDetails(id) {
  const automation = ui.data.automations.find(item => item.id === id);
  const steps = [...(automation.steps || [])].sort((a,b) => a.order - b.order);
  const group = ui.data.automationGroups.find(item => item.id === automation.groupId) || { name: automation.group || "Default", color: automation.color };
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar automation-modal" style="--item-color:${escAttr(colorValue(automation.color))}; --group-color:${escAttr(colorValue(group.color))}">
        ${modalAccent(automation.color)}
        <button class="modal-close" title="Close" tabindex="-1" data-modal-close>${icon("close")}</button>
        <header class="automation-modal-header">
          <div class="automation-modal-title">
            <span class="script-icon">${icon("coffee_maker")}</span>
            <span>${esc(automation.name || "Untitled automation")}</span>
          </div>
          <div class="automation-modal-group">${esc(group.name)}</div>
        </header>
        <section class="automation-summary">
          <p>${esc(automation.description || "No description")}</p>
          <button class="icon-button" title="Edit automation" data-auto-action="toggle-edit">${icon("edit")}</button>
        </section>
        <section class="automation-edit-panel" hidden>
          <div class="form-grid">
            <input id="automation-edit-name" value="${escAttr(automation.name)}">
            <textarea id="automation-edit-description">${esc(automation.description || "")}</textarea>
            <select id="automation-edit-group">${ui.data.automationGroups.map(group => `<option value="${group.id}" ${group.id === automation.groupId ? "selected" : ""}>${esc(group.name)}</option>`).join("")}</select>
            <label><input id="automation-edit-run-admin" type="checkbox" ${automation.runAsAdmin ? "checked" : ""}> Run as administrator</label>
            <label><input id="automation-edit-show-output" type="checkbox" ${automation.showOutputAfterRun ? "checked" : ""}> Show output after run</label>
            <label><input id="automation-edit-try-continue" type="checkbox" ${automation.tryContinueEvenIfFail ? "checked" : ""}> Try continue even if fail</label>
            <div class="inline-actions">
              <button class="ghost-button" data-auto-action="save">${icon("save")} Save Changes ${shortcutBadge("saveModalItem")}</button>
              <button class="ghost-button" data-auto-action="delete">${icon("delete")} Delete Automation</button>
            </div>
            <div class="divider"></div>
            ${iconPicker("automation-edit-icon", automation.icon || "account_tree")}
            ${colorPicker("automation-edit-color", automation.color || "#8083ff")}
          </div>
        </section>
        <section class="automation-steps-card">
          <div class="steps-card-header">
            <div>
              <h3>Script + configuration pairs</h3>
              <div class="meta">${steps.length} step${steps.length === 1 ? "" : "s"}</div>
            </div>
            <div class="inline-actions">
              <button class="ghost-button" data-auto-action="add" data-step-kind="Script">${icon("add")} Add Pair</button>
              <button class="ghost-button" data-auto-action="add" data-step-kind="Delay">${icon("timer")} Delay</button>
              <button class="ghost-button" data-auto-action="add" data-step-kind="ContinueConfirmation">${icon("task_alt")} Confirm</button>
              <button class="ghost-button" data-auto-action="add" data-step-kind="CustomOutput">${icon("terminal")} Output</button>
            </div>
          </div>
          <div class="common-list" data-auto-step-list>
            ${steps.map(step => automationStepRow(step)).join("") || `<div class="meta">No script/configuration pairs yet.</div>`}
          </div>
        </section>
        <footer class="automation-modal-footer">
          <button class="primary-button" data-run-auto="${automation.id}">${icon("play_arrow")} Run</button>
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
        </footer>
      </div>
    </div>
  `;
  bindIconPicker("automation-edit-icon");
  bindColorPicker("automation-edit-color");
  modalRoot.querySelectorAll("[data-modal-close]").forEach(button => button.onclick = closeModal);
  prepareInitialContentFocus(modalRoot);
  modalRoot.querySelector('[data-auto-action="toggle-edit"]').onclick = () => {
    const panel = modalRoot.querySelector(".automation-edit-panel");
    panel.hidden = !panel.hidden;
  };
  modalRoot.querySelector('[data-auto-action="save"]').onclick = async () => { await call("updateAutomation", { automationId: automation.id, name: value("automation-edit-name"), description: value("automation-edit-description"), groupId: value("automation-edit-group"), runAsAdmin: document.getElementById("automation-edit-run-admin").checked, showOutputAfterRun: document.getElementById("automation-edit-show-output").checked, tryContinueEvenIfFail: document.getElementById("automation-edit-try-continue").checked, icon: value("automation-edit-icon"), color: value("automation-edit-color") }); closeModal(); };
  modalRoot.querySelector('[data-auto-action="delete"]').onclick = () => {
    const phrase = `delete automation ${automation.name}`;
    phraseConfirm("Delete Automation", phrase, async () => {
      await call("deleteAutomation", { automationId: automation.id });
      closeModal();
    });
  };
  modalRoot.querySelectorAll('[data-auto-action="add"]').forEach(button => button.onclick = () => showAutomationStepModal(automation.id, null, button.dataset.stepKind || "Script"));
  modalRoot.querySelector("[data-run-auto]").onclick = async () => { await runAutomation(automation.id); };
  modalRoot.querySelectorAll("[data-remove-step]").forEach(button => button.onclick = async () => { await call("removeAutomationStep", { automationId: automation.id, order: Number(button.dataset.removeStep) }); closeModal(); });
  modalRoot.querySelectorAll("[data-edit-step]").forEach(button => button.onclick = () => showAutomationStepModal(automation.id, steps.find(step => String(step.order) === button.dataset.editStep)));
  bindAutomationStepDrag(automation.id);
}

function automationStepRow(step) {
  if (automationStepKind(step) !== "Script") return automationSpecialStepRow(step);
  const script = ui.data.scripts.find(s => s.id === step.scriptId);
  const config = script?.configurations?.find(c => c.id === step.configurationId);
  return `
    <div class="automation-step-row" draggable="true" data-auto-step-row="${step.order}">
      <span class="drag-handle" title="Drag to reorder">${icon("drag_handle")}</span>
      <div>
        <div class="script-title">${step.order + 1}. ${esc(script?.name || "missing")}</div>
        <div class="meta code-font">${esc(config?.name || "missing")}</div>
      </div>
      <div class="inline-actions">
        <button class="icon-button" title="Edit pair" data-edit-step="${step.order}">${icon("edit")}</button>
        <button class="icon-button" title="Remove pair" data-remove-step="${step.order}">${icon("delete")}</button>
      </div>
    </div>
  `;
}

function automationSpecialStepRow(step) {
  const kind = automationStepKind(step);
  const labels = {
    Delay: `Delay ${formatNumberSpaces(step.delayMilliseconds || ui.data.settings?.defaultDelay || 1000)} ms`,
    ContinueConfirmation: "Continue confirmation",
    CustomOutput: `Output: ${step.outputText || "message"}`
  };
  return `
    <div class="automation-step-row special-step" draggable="true" data-auto-step-row="${step.order}">
      <span class="drag-handle" title="Drag to reorder">${icon("drag_handle")}</span>
      <div>
        <div class="script-title">${step.order + 1}. ${esc(labels[kind] || kind)}</div>
        <div class="meta code-font">${esc(kind === "CustomOutput" ? (step.outputColor || "White") : "Automation control step")}</div>
      </div>
      <div class="inline-actions">
        <button class="icon-button" title="Edit step" data-edit-step="${step.order}">${icon("edit")}</button>
        <button class="icon-button" title="Remove step" data-remove-step="${step.order}">${icon("delete")}</button>
      </div>
    </div>
  `;
}

function bindAutomationStepDrag(automationId) {
  let dragged = null;
  modalRoot.querySelectorAll("[data-auto-step-row]").forEach(row => {
    row.ondragstart = () => { dragged = row; };
    row.ondragover = event => event.preventDefault();
    row.ondrop = async event => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      row.parentElement.insertBefore(dragged, row);
      await call("reorderAutomationSteps", { automationId, orders: [...modalRoot.querySelectorAll("[data-auto-step-row]")].map(item => Number(item.dataset.autoStepRow)) });
      closeModal();
    };
  });
}

function bindCheatEntryDrag() {
  let dragged = null;
  document.querySelectorAll("[data-cheat-entry-row]").forEach(row => {
    row.ondragstart = () => { dragged = row; };
    row.ondragover = event => {
      if (dragged?.dataset.cheatGroupId === row.dataset.cheatGroupId) {
        event.preventDefault();
      }
    };
    row.ondrop = async event => {
      event.preventDefault();
      if (!dragged || dragged === row || dragged.dataset.cheatGroupId !== row.dataset.cheatGroupId) return;
      row.parentElement.insertBefore(dragged, row);
      await call("reorderCheatSheetEntries", {
        groupId: row.dataset.cheatGroupId,
        entryIds: [...document.querySelectorAll(`[data-cheat-entry-row][data-cheat-group-id="${row.dataset.cheatGroupId}"]`)].map(item => item.dataset.cheatEntryRow)
      });
    };
  });
}

function showAutomationStepModal(automationId, step, initialKind = "Script") {
  const kind = step ? automationStepKind(step) : (initialKind || "Script");
  modal(step ? "Edit Script + Configuration" : "Add Script + Configuration", `
    <div class="form-grid">
      <label>Step type</label>
      <select id="step-kind">
        ${["Script", "Delay", "ContinueConfirmation", "CustomOutput"].map(item => `<option value="${item}" ${item === kind ? "selected" : ""}>${esc(item)}</option>`).join("")}
      </select>
      <div data-step-fields="Script">
        <select id="step-script">${ui.data.scripts.map(script => `<option value="${script.id}" ${script.id === step?.scriptId ? "selected" : ""}>${esc(script.name)}</option>`).join("")}</select>
        <select id="step-config"></select>
      </div>
      <div data-step-fields="Delay">
        <label>Delay milliseconds</label>
        <input id="step-delay" class="number-spaced-input" inputmode="numeric" value="${formatNumberSpaces(step?.delayMilliseconds || ui.data.settings?.defaultDelay || 1000)}">
      </div>
      <div data-step-fields="ContinueConfirmation">
        <p class="meta">Terminal will ask the user whether automation should continue.</p>
      </div>
      <div data-step-fields="CustomOutput">
        <textarea id="step-output-text" placeholder="Text to print in terminal">${esc(step?.outputText || "")}</textarea>
        <select id="step-output-color">${terminalColors.map(color => `<option value="${color}" ${color === (step?.outputColor || "White") ? "selected" : ""}>${color}</option>`).join("")}</select>
      </div>
    </div>
  `, async () => call(step ? "updateAutomationStep" : "addAutomationStep", {
    automationId,
    order: step?.order ?? -1,
    kind: value("step-kind"),
    scriptId: value("step-kind") === "Script" ? value("step-script") : "",
    configurationId: value("step-kind") === "Script" ? value("step-config") : "",
    delayMilliseconds: Math.max(1, parseSpacedInteger(value("step-delay")) || ui.data.settings?.defaultDelay || 1000),
    outputText: value("step-output-text"),
    outputColor: value("step-output-color") || "White"
  }));
  const scriptSelect = document.getElementById("step-script");
  const configSelect = document.getElementById("step-config");
  const sync = () => {
    const script = ui.data.scripts.find(item => item.id === scriptSelect.value);
    configSelect.innerHTML = (script?.configurations || []).map(config => `<option value="${config.id}" ${config.id === step?.configurationId ? "selected" : ""}>${esc(config.name)}</option>`).join("");
  };
  scriptSelect.onchange = sync;
  sync();
  const syncKind = () => document.querySelectorAll("[data-step-fields]").forEach(section => { section.hidden = section.dataset.stepFields !== value("step-kind"); });
  document.getElementById("step-kind").onchange = syncKind;
  syncKind();
  document.querySelectorAll(".number-spaced-input").forEach(input => {
    input.oninput = () => { input.value = formatNumberSpaces(parseSpacedInteger(input.value)); };
  });
}

async function runAutomation(automationId) {
  const automation = ui.data.automations.find(item => item.id === automationId);
  await showRunConfirmation({
    title: `Run ${automation?.name || "automation"}`,
    prepareAction: "prepareRunAutomation",
    runAction: "runAutomation",
    payload: { automationId },
    forceShowOutput: Boolean(automation?.showOutputAfterRun),
    onDone: () => { ui.page = "Logs"; }
  });
}

function showLog(id) {
  const log = ui.data.logs.find(item => item.id === id);
  if (!log) return;
  modal("Log Details", `
    <div class="form-grid">
      <div class="script-title">${esc(log.type)}: ${esc(log.name)}</div>
      <div class="meta code-font">${formatDate(log.startedAt)} -> ${formatDate(log.finishedAt)} | ${esc(log.result)} | exit ${log.exitCode}</div>
      ${(log.steps || []).map(step => `<div class="status-pill ${step.result === "Success" ? "ok" : "error"}">${esc(step.result)} ${esc(step.scriptName)} / ${esc(step.configurationName)} exit ${step.exitCode}</div>`).join("")}
      <div class="terminal-box">&gt; ${esc(log.commandLine || "")}\n${esc(log.terminalOutput || "")}</div>
    </div>
  `);
}

function showRunToast(log) {
  if (!log) return;
  document.querySelector(".run-toast")?.remove();
  const duration = formatDuration(log.startedAt, log.finishedAt);
  const ok = log.result === "Success";
  const toast = document.createElement("div");
  toast.className = `run-toast ${ok ? "ok" : "error"}`;
  toast.innerHTML = `
    <strong>${ok ? "Run completed" : "Run interrupted or failed"}</strong>
    <span>${esc(log.name || "Execution")} · ${esc(duration)}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);
}

async function saveSettings() {
  await call("saveSettings", {
    theme: ui.data.settings.theme,
    defaultTerminal: value("default-terminal"),
    openTerminalWindow: document.getElementById("open-terminal").checked,
    stopAutomationOnFailure: document.getElementById("stop-on-failure").checked,
    autoCloseTerminalAfterRun: document.getElementById("auto-close-terminal").checked,
    terminalCloseDelaySeconds: Number(value("terminal-close-delay") || 30),
    showOutputAfterRun: document.getElementById("show-output-after-run").checked,
    shouldWaitBetweenScripts: document.getElementById("should-wait-between-scripts").checked,
    waitBetweenScriptsMilliseconds: Math.max(1, parseSpacedInteger(value("wait-between-scripts")) || 1000),
    confirmationBetweenScripts: document.getElementById("confirmation-between-scripts").checked,
    defaultDelay: Math.max(1, parseSpacedInteger(value("default-delay")) || 1000),
    logDirectory: value("log-directory"),
    maxLogFolderSizeMb: Math.max(1, Number(value("max-log-folder-size") || 100))
  });
}

function modal(title, body, onConfirm = null) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal custom-scrollbar">
        <h2 class="modal-title">${esc(title)}</h2>
        ${body}
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          ${onConfirm ? `<button class="primary-button" data-modal-confirm>Confirm ${shortcutBadge("saveModalItem")}</button>` : ""}
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  prepareInitialContentFocus(modalRoot);
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
      <div class="modal custom-scrollbar danger-modal">
        <div class="danger-strip"></div>
        <h2 class="modal-title">${esc(title)}</h2>
        <p class="danger-message">Type <strong>${esc(phrase)}</strong> to confirm.</p>
        <input id="phrase-confirm-input" class="danger-input" placeholder="${escAttr(phrase)}">
        <div class="modal-actions">
          <button class="ghost-button" data-modal-close>Cancel ${shortcutBadge("closeModal")}</button>
          <button class="danger-button" data-phrase-confirm>Confirm ${shortcutBadge("saveModalItem")}</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector("[data-modal-close]").onclick = closeModal;
  prepareInitialContentFocus(modalRoot);
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
  const recent = ui.recentColors.filter(item => !colorPalette.includes(item)).slice(0, 10);
  const recentSlots = Array.from({ length: 10 }, (_, index) => recent[index]);
  return `
    <div class="form-grid color-picker-field">
      <label>Color</label>
      <div class="color-picker" data-color-picker="${id}">
        <div class="palette compact-palette">
          <div class="color-current" data-color-current="${id}">
            <span class="color-current-preview" style="--swatch-color:${escAttr(color)}"></span>
            <span class="color-current-code">${esc(color)}</span>
          </div>
          ${colorPalette.map(item => `<button type="button" class="swatch" style="--swatch-color:${escAttr(item)}" data-color-target="${id}" data-color="${escAttr(item)}" title="${escAttr(item)}"></button>`).join("")}
          <span class="palette-separator"></span>
          <button type="button" class="swatch custom-swatch" data-color-custom-toggle="${id}" title="Custom color"></button>
          <div class="recent-color-row" data-color-recent-row="${id}">
            ${recentSlots.map((item, index) => recentSwatch(id, item, index)).join("")}
          </div>
        </div>
        <div class="color-popover" data-color-custom-panel="${id}" hidden>
          <button type="button" class="color-spectrum" data-color-spectrum="${id}" aria-label="Choose color"></button>
          <label class="brightness-control">
            <span>Brightness</span>
            <input id="${id}-brightness" type="range" min="25" max="100" value="92">
          </label>
          <input id="${id}-manual" value="${escAttr(color)}" placeholder="#4fdbc8 or rgb(79, 219, 200)">
          <input id="${id}-native" type="color" value="${escAttr(color)}">
          <button type="button" class="ghost-button" data-color-manual-apply="${id}">Use Color</button>
        </div>
      </div>
      <input id="${id}" type="hidden" value="${escAttr(color)}">
    </div>
  `;
}

function recentSwatch(id, item, index) {
  if (!item) {
    return `<span class="swatch recent-swatch empty-recent-swatch" data-color-recent-slot="${id}" data-recent-index="${index}" title="No recent custom color"></span>`;
  }
  return `<button type="button" class="swatch recent-swatch" style="--swatch-color:${escAttr(item)}" data-color-target="${id}" data-color="${escAttr(item)}" data-color-custom="true" data-color-recent-slot="${id}" data-recent-index="${index}" title="${escAttr(item)}"></button>`;
}

function iconPicker(id, selected) {
  const current = selected || "code";
  return `
    <div class="form-grid icon-picker-field">
      <label>Icon</label>
      <div class="icon-picker" data-icon-picker="${id}">
        <button type="button" class="icon-picker-current" data-icon-picker-toggle="${id}" title="${escAttr(current)}">
          ${icon(current)}
        </button>
        <div class="icon-palette" data-icon-picker-panel="${id}" hidden>
          ${iconCatalog.map(item => `<button type="button" class="icon-choice" data-icon-target="${id}" data-icon-value="${escAttr(item)}" title="${escAttr(item)}">${icon(item)}</button>`).join("")}
        </div>
      </div>
      <input id="${id}" type="hidden" value="${escAttr(current)}">
    </div>
  `;
}

function bindIconPicker(id) {
  const toggle = modalRoot.querySelector(`[data-icon-picker-toggle="${id}"]`);
  const panel = modalRoot.querySelector(`[data-icon-picker-panel="${id}"]`);
  toggle?.addEventListener("click", event => {
    event.preventDefault();
    panel.hidden = !panel.hidden;
  });
  modalRoot.querySelectorAll(`[data-icon-target="${id}"]`).forEach(button => button.onclick = event => {
    event.preventDefault();
    const value = button.dataset.iconValue;
    document.getElementById(id).value = value;
    if (toggle) {
      toggle.innerHTML = icon(value);
      toggle.title = value;
    }
    panel.hidden = true;
  });
}

function bindColorPicker(id) {
  const hidden = document.getElementById(id);
  const manual = document.getElementById(`${id}-manual`);
  const native = document.getElementById(`${id}-native`);
  const brightness = document.getElementById(`${id}-brightness`);
  const panel = modalRoot.querySelector(`[data-color-custom-panel="${id}"]`);
  const toggle = modalRoot.querySelector(`[data-color-custom-toggle="${id}"]`);
  const current = modalRoot.querySelector(`[data-color-current="${id}"]`);
  const spectrum = modalRoot.querySelector(`[data-color-spectrum="${id}"]`);
  const picker = modalRoot.querySelector(`[data-color-picker="${id}"]`);
  const refreshRecent = () => {
    const row = modalRoot.querySelector(`[data-color-recent-row="${id}"]`);
    if (!row) return;
    const recent = ui.recentColors.filter(item => !colorPalette.includes(item)).slice(0, 10);
    row.innerHTML = Array.from({ length: 10 }, (_, index) => recentSwatch(id, recent[index], index)).join("");
    row.querySelectorAll(`[data-color-target="${id}"]`).forEach(button => button.onclick = event => {
      event.preventDefault();
      set(button.dataset.color, true);
    });
  };
  const set = (raw, remember = false) => {
    const color = colorValue(raw);
    hidden.value = color;
    if (manual) manual.value = color;
    if (native) native.value = color;
    if (current) {
      current.querySelector(".color-current-preview")?.style.setProperty("--swatch-color", color);
      const code = current.querySelector(".color-current-code");
      if (code) code.textContent = color;
    }
    if (remember) {
      rememberColor(color);
      refreshRecent();
    }
  };
  toggle?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  modalRoot.querySelector(".modal")?.addEventListener("click", event => {
    if (!panel || panel.hidden || picker?.contains(event.target)) return;
    panel.hidden = true;
  });
  modalRoot.querySelectorAll(`[data-color-target="${id}"]`).forEach(button => button.onclick = event => {
    event.preventDefault();
    set(button.dataset.color, button.dataset.colorCustom === "true");
    if (panel) panel.hidden = true;
  });
  spectrum?.addEventListener("click", event => {
    event.preventDefault();
    const rect = spectrum.getBoundingClientRect();
    const hue = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 360;
    const saturation = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * 0.78;
    const value = Number(brightness?.value || 92) / 100;
    set(hsvToHex(hue, saturation, value), true);
  });
  brightness?.addEventListener("input", () => set(adjustBrightness(hidden.value, Number(brightness.value) / 100), true));
  modalRoot.querySelector(`[data-color-manual-apply="${id}"]`)?.addEventListener("click", event => {
    event.preventDefault();
    set(manual.value, true);
    if (panel) panel.hidden = true;
  });
  native?.addEventListener("input", () => set(native.value, true));
}

function modalAccent(color) {
  return `<div class="modal-accent" style="--item-color:${escAttr(colorValue(color))}"></div>`;
}

function loadRecentColors() {
  try {
    const stored = JSON.parse(localStorage.getItem("scriptmanager.recentColors") || "[]");
    return Array.isArray(stored) ? stored.map(colorValue).filter(item => !colorPalette.includes(item)).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function loadShortcuts() {
  try {
    const stored = JSON.parse(localStorage.getItem("scriptmanager.shortcuts") || "{}");
    if (!stored.saveModalItem || stored.saveModalItem === "Enter") stored.saveModalItem = defaultShortcuts.saveModalItem;
    return { ...defaultShortcuts, ...stored };
  } catch {
    return { ...defaultShortcuts };
  }
}

function saveShortcuts() {
  localStorage.setItem("scriptmanager.shortcuts", JSON.stringify(ui.shortcuts));
}

function eventToShortcut(event) {
  const key = event.key === " " ? "Space" : event.key === "Delete" ? "Del" : event.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return "";
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

function shortcutBadge(key) {
  const value = key ? ui.shortcuts[key] : "";
  return value ? `<span class="shortcut-badge">${esc(value)}</span>` : "";
}

function applyShortcutLabels() {
  const pageKeys = {
    Scripts: "pageScripts",
    Automations: "pageAutomations",
    "Environment Variables": "pageEnvironment",
    "Cheat Sheet": "pageCheatSheet",
    "Import & Backup": "pageImportBackup",
    Logs: "pageLogs",
    Settings: "pageSettings"
  };
  document.querySelectorAll("[data-page]").forEach(button => {
    button.querySelector(".shortcut-badge")?.remove();
    button.insertAdjacentHTML("beforeend", shortcutBadge(pageKeys[button.dataset.page]));
  });
}

function rememberColor(value) {
  const color = colorValue(value);
  if (colorPalette.includes(color)) return;
  ui.recentColors = [color, ...ui.recentColors.filter(item => item !== color)].slice(0, 10);
  localStorage.setItem("scriptmanager.recentColors", JSON.stringify(ui.recentColors));
}

function colorValue(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(text)) return "#" + text.slice(1).split("").map(part => part + part).join("").toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text);
  if (!rgb) return "#c0c1ff";
  return "#" + rgb.slice(1).map(part => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("");
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const match = value - chroma;
  const [r, g, b] = hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
      : hue < 180 ? [0, chroma, x]
        : hue < 240 ? [0, x, chroma]
          : hue < 300 ? [x, 0, chroma]
            : [chroma, 0, x];
  return "#" + [r, g, b].map(part => Math.round((part + match) * 255).toString(16).padStart(2, "0")).join("");
}

function adjustBrightness(value, brightness) {
  const color = colorValue(value);
  const channels = [color.slice(1, 3), color.slice(3, 5), color.slice(5, 7)].map(part => parseInt(part, 16));
  const max = Math.max(...channels, 1);
  return "#" + channels.map(part => Math.round((part / max) * 255 * brightness).toString(16).padStart(2, "0")).join("");
}

function updateStatus(value) {
  const statusClass = value === "UPTODATE" ? "ok" : value === "OUTDATED" ? "warn" : "error";
  return `<span class="status-pill ${statusClass}">${esc(value || "NOINFO")}</span>`;
}

function icon(name) {
  if (brandIconLabels[name]) {
    return `<span class="brand-symbol" data-icon="${escAttr(name)}">${esc(brandIconLabels[name])}</span>`;
  }
  if (String(name || "").startsWith("brand:")) name = "terminal_2";

  const map = {
    terminal: "terminal_2",
    terminal_2: "terminal_2",
    search: "search",
    collapse_all: "collapse_all",
    grid_view: "grid_view",
    view_list: "view_list",
    autorenew: "autorenew",
    restart_alt: "restart_alt",
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
    print: "print",
    file_save: "file_save",
    play_arrow: "play_arrow",
    info: "info",
    save: "save",
    arrow_circle_up: "arrow_circle_up",
    edit_document: "edit_document",
    close: "close",
    drag_handle: "drag_handle",
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

function formatParameters(parameters) {
  return (parameters || []).map(parameter => {
    const name = parameter?.name ?? "";
    const value = parameter?.value ?? "";
    return value === "" ? name : `${name}=${value}`;
  }).join("\n");
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
function automationStepKind(step) {
  const map = ["Script", "Delay", "ContinueConfirmation", "CustomOutput"];
  return typeof step?.kind === "number" ? map[step.kind] || "Script" : (step?.kind || "Script");
}
function formatDuration(start, end) {
  const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  if (!Number.isFinite(ms)) return "unknown duration";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}
function formatNumberSpaces(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}
function formatMb(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"} MB`;
}
function parseSpacedInteger(value) {
  const parsed = Number(String(value || "").replace(/\s+/g, "").replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }
function escAttr(value) { return esc(value).replace(/`/g, "&#96;"); }

refresh().catch(error => showError(error.message));
