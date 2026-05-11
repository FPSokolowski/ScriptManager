using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using ScriptManager.Core;

namespace ScriptManager.App;

public sealed class MainForm : Form
{
    private const string UpdateVersionUrl = "https://scriptmanager.sokolowskifilip.pl/update/version";
    private const string UpdateInstallerFallbackUrl = "https://scriptmanager.sokolowskifilip.pl/update/installer";
    private const int DwmWindowAttributeUseImmersiveDarkMode = 20;
    private const int DwmWindowAttributeUseImmersiveDarkModeBefore20H1 = 19;
    private const int DwmWindowAttributeCaptionColor = 35;
    private const int DwmWindowAttributeTextColor = 36;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly AppPaths _paths = AppPaths.ForCurrentUser();
    private readonly IScriptRepository _repository;
    private readonly ScriptLibraryService _library;
    private readonly ScriptExecutionService _execution;
    private readonly EnvironmentVariableService _environment = new();
    private readonly WebView2 _webView = new();
    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(10) };
    private UpdateInfo _updateInfo = new("NOINFO", null, null, null, null);

    public MainForm()
    {
        Text = "ScriptManager";
        Width = 1200;
        Height = 600;
        MinimumSize = new Size(560, 420);
        AllowDrop = true;
        var iconPath = Path.Combine(AppContext.BaseDirectory, "wwwroot", "img", "icon.ico");
        if (File.Exists(iconPath))
        {
            Icon = new Icon(iconPath);
        }

        _paths.Ensure();
        _repository = new LiteDbScriptRepository(_paths.DatabasePath);
        _library = new ScriptLibraryService(_repository, _paths);
        _execution = new ScriptExecutionService(_repository, _library);
        _library.CompareAndUpdateAll();
        var settings = _repository.GetSettings();
        RestoreWindowPlacement(settings);
        ApplyWindowTheme(settings.Theme);

        _webView.Dock = DockStyle.Fill;
        _webView.AllowExternalDrop = false;
        _webView.DragEnter += WebViewDragEnter;
        _webView.DragDrop += WebViewDragDrop;
        DragEnter += WebViewDragEnter;
        DragDrop += WebViewDragDrop;
        Controls.Add(_webView);

        Load += async (_, _) => await InitializeWebViewAsync();
        FormClosing += (_, _) => SaveWindowPlacement();
        FormClosed += (_, _) =>
        {
            _repository.Dispose();
            _httpClient.Dispose();
        };
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyWindowTheme(_repository?.GetSettings().Theme ?? "Dark");
    }

    private static ScriptConfiguration ReadConfiguration(JsonElement element)
    {
        var id = element.TryGetProperty("id", out var idValue) && Guid.TryParse(idValue.GetString(), out var parsedId) ? parsedId : Guid.NewGuid();
        var parameters = new List<ScriptParameter>();
        if (element.TryGetProperty("parameters", out var parameterArray) && parameterArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var parameter in parameterArray.EnumerateArray())
            {
                parameters.Add(new ScriptParameter
                {
                    Name = GetString(parameter, "name", ""),
                    Value = GetString(parameter, "value", "")
                });
            }
        }

        return new ScriptConfiguration
        {
            Id = id,
            Name = GetString(element, "name", "Default"),
            Description = GetString(element, "description", ""),
            WorkingDirectory = GetString(element, "workingDirectory", ""),
            RunAsAdmin = element.TryGetProperty("runAsAdmin", out var admin) && admin.GetBoolean(),
            Parameters = parameters
        };
    }

    private static string GetApplicationVersion()
    {
        var informationalVersion = typeof(MainForm).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(informationalVersion))
        {
            return informationalVersion.Split('+')[0];
        }

        return typeof(MainForm).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
    }

    private static string? ExtractUpdateValue(string response, params string[] names)
    {
        try
        {
            using var document = JsonDocument.Parse(response);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (var name in names)
            {
                if (document.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                {
                    return value.GetString();
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static string? NormalizeInstallerUrl(string? installerUrl)
    {
        if (string.IsNullOrWhiteSpace(installerUrl))
        {
            return UpdateInstallerFallbackUrl;
        }

        return Uri.TryCreate(installerUrl, UriKind.Absolute, out var absolute)
            ? absolute.ToString()
            : new Uri(new Uri(UpdateVersionUrl), installerUrl).ToString();
    }

    private static bool TryParseVersion(string? value, out Version version)
    {
        var cleaned = new string((value ?? "").Trim().TrimStart('v', 'V').TakeWhile(ch => char.IsDigit(ch) || ch == '.').ToArray());
        if (Version.TryParse(cleaned, out var parsed))
        {
            version = parsed;
            return true;
        }

        version = new Version(0, 0, 0);
        return false;
    }

    private static EnvironmentVariableTarget GetEnvTarget(JsonElement payload)
    {
        var value = GetString(payload, "environmentTarget", "User");
        return value.Equals("Machine", StringComparison.OrdinalIgnoreCase) || value.Equals("System", StringComparison.OrdinalIgnoreCase)
            ? EnvironmentVariableTarget.Machine
            : EnvironmentVariableTarget.User;
    }

    private static Guid GetGuid(JsonElement element, string property) => Guid.Parse(GetString(element, property));

    private static Guid? GetOptionalGuid(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && Guid.TryParse(value.GetString(), out var id) ? id : null;

    private static string GetString(JsonElement element, string property, string defaultValue = "")
    {
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.GetString() ?? defaultValue
            : defaultValue;
    }

    private static string GetColor(JsonElement element, string property, string defaultValue)
    {
        var color = GetString(element, property, defaultValue).Trim();
        if (color.StartsWith('#') && ( color.Length == 7 || color.Length == 4 ))
        {
            return color;
        }

        if (color.StartsWith("rgb(", StringComparison.OrdinalIgnoreCase) && color.EndsWith(')'))
        {
            var parts = color[4..^1].Split(',', StringSplitOptions.TrimEntries);
            if (parts.Length == 3 && parts.All(part => int.TryParse(part, out var value) && value is >= 0 and <= 255))
            {
                return "#" + string.Concat(parts.Select(part => int.Parse(part).ToString("x2")));
            }
        }

        return defaultValue;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

    private static ExecutionLog CloneLog(ExecutionLog log, bool includeOutput)
    {
        return new ExecutionLog
        {
            Id = log.Id,
            StartedAt = log.StartedAt,
            FinishedAt = log.FinishedAt,
            Result = log.Result,
            Type = log.Type,
            Name = log.Name,
            Configuration = log.Configuration,
            CommandLine = log.CommandLine,
            WorkingDirectory = log.WorkingDirectory,
            ExitCode = log.ExitCode,
            TerminalOutput = includeOutput ? log.TerminalOutput : "",
            Steps = log.Steps.Select(step => new ExecutionStepLog
            {
                ScriptId = step.ScriptId,
                ConfigurationId = step.ConfigurationId,
                ScriptName = step.ScriptName,
                ConfigurationName = step.ConfigurationName,
                Result = step.Result,
                ExitCode = step.ExitCode,
                Output = includeOutput ? step.Output : ""
            }).ToList()
        };
    }

    private static void WriteJsonEntry<T>(ZipArchive archive, string entryName, T value)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var stream = entry.Open();
        JsonSerializer.Serialize(stream, value, JsonOptions);
    }

    private static void WriteTextEntry(ZipArchive archive, string entryName, string text)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open());
        writer.Write(text);
    }

    private static int ToColorRef(Color color) => color.R | ( color.G << 8 ) | ( color.B << 16 );

    private async Task InitializeWebViewAsync()
    {
        var userData = Path.Combine(_paths.Root, "webview2");
        Directory.CreateDirectory(userData);
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userData);
        await _webView.EnsureCoreWebView2Async(environment);
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
        _webView.CoreWebView2.WebMessageReceived += WebMessageReceived;
        _webView.CoreWebView2.NavigationCompleted += async (_, _) =>
        {
            await RefreshUpdateInfoAsync();
            await ExecuteFrontendRefreshAsync();
        };

        var index = Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html");
        _webView.CoreWebView2.Navigate(new Uri(index).AbsoluteUri);
    }

    private async void WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        BridgeRequest? request = null;
        try
        {
            request = JsonSerializer.Deserialize<BridgeRequest>(e.WebMessageAsJson, JsonOptions);
            if (request is null)
            {
                return;
            }

            var data = await DispatchAsync(request.Action, request.Payload);
            await ReplyAsync(request.Id, true, data, null);
        }
        catch (Exception ex)
        {
            await ReplyAsync(request?.Id ?? "", false, null, ex.Message);
        }
    }

    private async Task<object?> DispatchAsync(string action, JsonElement payload)
    {
        switch (action)
        {
            case "getState":
                return BuildState(GetEnvTarget(payload));

            case "importScripts":
                ImportScriptsFromDialog();
                return BuildState(GetEnvTarget(payload));

            case "updateAllScripts":
                _library.CompareAndUpdateAll();
                return BuildState(GetEnvTarget(payload));

            case "createScript":
                var createdScript = _library.CreateScript(GetString(payload, "name"), GetString(payload, "content"), GetString(payload, "extension", ".ps1"));
                createdScript.Color = GetColor(payload, "color", createdScript.Color);
                createdScript.Icon = GetString(payload, "icon", createdScript.Icon);
                _repository.UpsertScript(createdScript);
                return BuildState(GetEnvTarget(payload));

            case "createScriptGroup":
                _repository.UpsertScriptGroup(new ScriptGroup { Name = GetString(payload, "name"), Description = GetString(payload, "description", ""), Color = GetColor(payload, "color", "#4fdbc8") });
                return BuildState(GetEnvTarget(payload));

            case "updateScriptGroup":
                UpdateScriptGroup(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteScriptGroup":
                _repository.DeleteScriptGroup(GetGuid(payload, "groupId"));
                return BuildState(GetEnvTarget(payload));

            case "updateScript":
                UpdateScript(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteScript":
                _repository.DeleteScript(GetGuid(payload, "scriptId"));
                return BuildState(GetEnvTarget(payload));

            case "getScriptCode":
                return GetScriptCode(GetGuid(payload, "scriptId"));

            case "saveConfiguration":
                SaveConfiguration(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteConfiguration":
                _library.DeleteConfiguration(GetGuid(payload, "scriptId"), GetGuid(payload, "configurationId"));
                return BuildState(GetEnvTarget(payload));

            case "duplicateConfiguration":
                DuplicateConfiguration(GetGuid(payload, "scriptId"), GetGuid(payload, "configurationId"));
                return BuildState(GetEnvTarget(payload));

            case "reorderConfigurations":
                ReorderConfigurations(payload);
                return BuildState(GetEnvTarget(payload));

            case "runScript":
                await _execution.RunScriptAsync(GetGuid(payload, "scriptId"), GetGuid(payload, "configurationId"));
                return BuildState(GetEnvTarget(payload));

            case "createAutomationGroup":
                _repository.UpsertAutomationGroup(new AutomationGroup { Name = GetString(payload, "name"), Description = GetString(payload, "description", ""), Color = GetColor(payload, "color", "#ffb783") });
                return BuildState(GetEnvTarget(payload));

            case "updateAutomationGroup":
                UpdateAutomationGroup(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteAutomationGroup":
                _repository.DeleteAutomationGroup(GetGuid(payload, "groupId"));
                return BuildState(GetEnvTarget(payload));

            case "createAutomation":
                CreateAutomation(payload);
                return BuildState(GetEnvTarget(payload));

            case "updateAutomation":
                UpdateAutomation(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteAutomation":
                _repository.DeleteAutomation(GetGuid(payload, "automationId"));
                return BuildState(GetEnvTarget(payload));

            case "addAutomationStep":
                AddAutomationStep(payload);
                return BuildState(GetEnvTarget(payload));

            case "removeAutomationStep":
                RemoveAutomationStep(payload);
                return BuildState(GetEnvTarget(payload));

            case "runAutomation":
                await _execution.RunAutomationAsync(GetGuid(payload, "automationId"));
                return BuildState(GetEnvTarget(payload));

            case "saveSettings":
                SaveSettings(payload);
                return BuildState(GetEnvTarget(payload));

            case "setEnvironmentVariable":
                _environment.Set(GetString(payload, "name"), GetString(payload, "value", ""), GetEnvTarget(payload));
                return BuildState(GetEnvTarget(payload));

            case "checkForUpdates":
                await RefreshUpdateInfoAsync();
                return BuildState(GetEnvTarget(payload));

            case "downloadAndRunInstaller":
                await DownloadAndRunInstallerAsync();
                return BuildState(GetEnvTarget(payload));

            case "exportBackup":
                ExportBackup();
                return BuildState(GetEnvTarget(payload));

            case "importBackup":
                ImportBackup();
                return BuildState(GetEnvTarget(payload));

            case "saveCheatSheetGroup":
                SaveCheatSheetGroup(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteCheatSheetGroup":
                _repository.DeleteCheatSheetGroup(GetGuid(payload, "groupId"));
                return BuildState(GetEnvTarget(payload));

            case "saveCheatSheetEntry":
                SaveCheatSheetEntry(payload);
                return BuildState(GetEnvTarget(payload));

            case "deleteCheatSheetEntry":
                _repository.DeleteCheatSheetEntry(GetGuid(payload, "entryId"));
                return BuildState(GetEnvTarget(payload));

            default:
                throw new InvalidOperationException($"Unknown bridge action: {action}");
        }
    }

    private object BuildState(EnvironmentVariableTarget envTarget)
    {
        var scripts = _repository.GetScripts();
        var automations = _repository.GetAutomations();
        return new
        {
            scripts,
            scriptGroups = _repository.GetScriptGroups(),
            automationGroups = _repository.GetAutomationGroups(),
            automations,
            cheatSheetGroups = _repository.GetCheatSheetGroups(),
            cheatSheetEntries = _repository.GetCheatSheetEntries(),
            logs = _repository.GetLogs(300),
            settings = _repository.GetSettings(),
            environmentTarget = envTarget.ToString(),
            environmentVariables = _environment.Get(envTarget).Take(200),
            terminal = ScriptExecutionService.DetectTerminal(),
            appVersion = GetApplicationVersion(),
            updateInfo = _updateInfo
        };
    }

    private void ImportScriptsFromDialog()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Import scripts",
            Multiselect = true,
            Filter = "Scripts|*.ps1;*.cmd;*.bat;*.sh;*.py;*.js;*.ts;*.sql;*.txt|All files|*.*"
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        foreach (var file in dialog.FileNames)
        {
            _library.ImportScript(file);
        }
    }

    private void ExportBackup()
    {
        using var dialog = new SaveFileDialog
        {
            Title = "Export ScriptManager backup",
            Filter = "ScriptManager backup|*.zip",
            FileName = $"scriptmanager-backup-{DateTime.Now:yyyyMMdd-HHmmss}.zip",
            OverwritePrompt = true
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        if (File.Exists(dialog.FileName))
        {
            File.Delete(dialog.FileName);
        }

        var scripts = _repository.GetScripts();
        var logs = _repository.GetLogs(int.MaxValue);
        var manifest = new BackupManifest(
            ExportedAt: DateTime.UtcNow,
            AppVersion: GetApplicationVersion(),
            Settings: _repository.GetSettings(),
            ScriptGroups: _repository.GetScriptGroups(),
            Scripts: scripts,
            AutomationGroups: _repository.GetAutomationGroups(),
            Automations: _repository.GetAutomations(),
            CheatSheetGroups: _repository.GetCheatSheetGroups(),
            CheatSheetEntries: _repository.GetCheatSheetEntries(),
            Logs: logs.Select(log => CloneLog(log, includeOutput: false)).ToList());

        using var archive = ZipFile.Open(dialog.FileName, ZipArchiveMode.Create);
        WriteJsonEntry(archive, "scriptmanager-backup.json", manifest);

        foreach (var script in scripts.Where(script => File.Exists(script.LocalPath)))
        {
            var extension = Path.GetExtension(script.LocalPath);
            archive.CreateEntryFromFile(script.LocalPath, $"scripts/{script.Id:N}{extension}", CompressionLevel.Optimal);
        }

        foreach (var log in logs)
        {
            WriteTextEntry(archive, $"logs/{log.Id:N}.txt", log.TerminalOutput ?? "");
        }
    }

    private void ImportBackup()
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Import ScriptManager backup",
            Filter = "ScriptManager backup|*.zip|All files|*.*",
            Multiselect = false
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return;
        }

        using var archive = ZipFile.OpenRead(dialog.FileName);
        var manifestEntry = archive.GetEntry("scriptmanager-backup.json") ?? throw new InvalidOperationException("Backup manifest was not found.");
        using var manifestStream = manifestEntry.Open();
        var manifest = JsonSerializer.Deserialize<BackupManifest>(manifestStream, JsonOptions) ?? throw new InvalidOperationException("Backup manifest could not be read.");

        _repository.SaveSettings(manifest.Settings);
        foreach (var group in manifest.ScriptGroups)
        {
            _repository.UpsertScriptGroup(group);
        }

        foreach (var script in manifest.Scripts)
        {
            var scriptEntry = archive.Entries.FirstOrDefault(entry => entry.FullName.StartsWith($"scripts/{script.Id:N}", StringComparison.OrdinalIgnoreCase));
            if (scriptEntry is not null)
            {
                var destination = Path.Combine(_paths.Scripts, Path.GetFileName(scriptEntry.FullName));
                scriptEntry.ExtractToFile(destination, overwrite: true);
                script.LocalPath = destination;
            }

            _repository.UpsertScript(script);
        }

        foreach (var group in manifest.AutomationGroups)
        {
            _repository.UpsertAutomationGroup(group);
        }

        foreach (var automation in manifest.Automations)
        {
            _repository.UpsertAutomation(automation);
        }

        foreach (var group in manifest.CheatSheetGroups)
        {
            _repository.UpsertCheatSheetGroup(group);
        }

        foreach (var entry in manifest.CheatSheetEntries)
        {
            _repository.UpsertCheatSheetEntry(entry);
        }

        var existingLogIds = _repository.GetLogs(int.MaxValue).Select(log => log.Id).ToHashSet();
        foreach (var log in manifest.Logs.Where(log => !existingLogIds.Contains(log.Id)))
        {
            var logEntry = archive.GetEntry($"logs/{log.Id:N}.txt");
            if (logEntry is not null)
            {
                using var reader = new StreamReader(logEntry.Open());
                log.TerminalOutput = reader.ReadToEnd();
            }

            _repository.AddLog(log);
        }
    }

    private void UpdateScript(JsonElement payload)
    {
        var script = _repository.GetScript(GetGuid(payload, "scriptId")) ?? throw new InvalidOperationException("Script not found.");
        script.Name = GetString(payload, "name", script.Name);
        script.Description = GetString(payload, "description", script.Description);
        script.Icon = GetString(payload, "icon", script.Icon);
        script.Color = GetColor(payload, "color", script.Color);
        if (payload.TryGetProperty("groupId", out var groupValue) && Guid.TryParse(groupValue.GetString(), out var groupId))
        {
            var group = _repository.GetScriptGroups().FirstOrDefault(x => x.Id == groupId);
            if (group is not null)
            {
                script.GroupId = group.Id;
                script.Group = group.Name;
            }
        }
        _repository.UpsertScript(script);
    }

    private void UpdateScriptGroup(JsonElement payload)
    {
        var group = _repository.GetScriptGroups().FirstOrDefault(x => x.Id == GetGuid(payload, "groupId")) ?? throw new InvalidOperationException("Script group not found.");
        group.Name = GetString(payload, "name", group.Name);
        group.Description = GetString(payload, "description", group.Description);
        group.Color = GetColor(payload, "color", group.Color);
        _repository.UpsertScriptGroup(group);
    }

    private string GetScriptCode(Guid scriptId)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        return File.Exists(script.LocalPath) ? File.ReadAllText(script.LocalPath) : "Local file missing.";
    }

    private void SaveConfiguration(JsonElement payload)
    {
        var script = _repository.GetScript(GetGuid(payload, "scriptId")) ?? throw new InvalidOperationException("Script not found.");
        var config = ReadConfiguration(payload.GetProperty("configuration"));
        var existing = script.Configurations.FirstOrDefault(x => x.Id == config.Id);
        if (existing is null)
        {
            config.Order = script.Configurations.Count;
            script.Configurations.Add(config);
        }
        else
        {
            existing.Name = config.Name;
            existing.Description = config.Description;
            existing.WorkingDirectory = config.WorkingDirectory;
            existing.RunAsAdmin = config.RunAsAdmin;
            existing.Parameters = config.Parameters;
        }
        _repository.UpsertScript(script);
    }

    private void DuplicateConfiguration(Guid scriptId, Guid configurationId)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        var source = script.Configurations.First(x => x.Id == configurationId);
        script.Configurations.Add(new ScriptConfiguration
        {
            Name = source.Name + " copy",
            Description = source.Description,
            WorkingDirectory = source.WorkingDirectory,
            RunAsAdmin = source.RunAsAdmin,
            Order = script.Configurations.Count,
            Parameters = source.Parameters.Select(x => new ScriptParameter { Name = x.Name, Value = x.Value }).ToList()
        });
        _repository.UpsertScript(script);
    }

    private void ReorderConfigurations(JsonElement payload)
    {
        var script = _repository.GetScript(GetGuid(payload, "scriptId")) ?? throw new InvalidOperationException("Script not found.");
        var ids = payload.GetProperty("configurationIds").EnumerateArray().Select(x => Guid.Parse(x.GetString()!)).ToList();
        foreach (var config in script.Configurations)
        {
            var index = ids.IndexOf(config.Id);
            if (index >= 0)
            {
                config.Order = index;
            }
        }
        _repository.UpsertScript(script);
    }

    private void CreateAutomation(JsonElement payload)
    {
        var group = _repository.GetAutomationGroups().FirstOrDefault(x => x.Id == GetOptionalGuid(payload, "groupId"))
            ?? _repository.GetAutomationGroups().First();
        _repository.UpsertAutomation(new AutomationRecord
        {
            Name = GetString(payload, "name"),
            Description = GetString(payload, "description", ""),
            GroupId = group.Id,
            Group = group.Name,
            Icon = GetString(payload, "icon", "account_tree"),
            Color = GetColor(payload, "color", "#8083ff"),
            CreatedAt = DateTime.UtcNow,
            LastModifiedAt = DateTime.UtcNow
        });
    }

    private void UpdateAutomation(JsonElement payload)
    {
        var automation = _repository.GetAutomation(GetGuid(payload, "automationId")) ?? throw new InvalidOperationException("Automation not found.");
        automation.Name = GetString(payload, "name", automation.Name);
        automation.Description = GetString(payload, "description", automation.Description);
        automation.Icon = GetString(payload, "icon", automation.Icon);
        automation.Color = GetColor(payload, "color", automation.Color);
        if (payload.TryGetProperty("groupId", out var groupValue) && Guid.TryParse(groupValue.GetString(), out var groupId))
        {
            var group = _repository.GetAutomationGroups().FirstOrDefault(x => x.Id == groupId);
            if (group is not null)
            {
                automation.GroupId = group.Id;
                automation.Group = group.Name;
            }
        }
        automation.LastModifiedAt = DateTime.UtcNow;
        _repository.UpsertAutomation(automation);
    }

    private void UpdateAutomationGroup(JsonElement payload)
    {
        var group = _repository.GetAutomationGroups().FirstOrDefault(x => x.Id == GetGuid(payload, "groupId")) ?? throw new InvalidOperationException("Automation group not found.");
        group.Name = GetString(payload, "name", group.Name);
        group.Description = GetString(payload, "description", group.Description);
        group.Color = GetColor(payload, "color", group.Color);
        _repository.UpsertAutomationGroup(group);
    }

    private void SaveCheatSheetGroup(JsonElement payload)
    {
        var id = GetOptionalGuid(payload, "groupId") ?? Guid.NewGuid();
        var group = _repository.GetCheatSheetGroup(id) ?? new CheatSheetGroup { Id = id };
        group.Name = GetString(payload, "name", group.Name);
        group.Color = GetColor(payload, "color", group.Color);
        group.Icon = GetString(payload, "icon", group.Icon);
        _repository.UpsertCheatSheetGroup(group);
    }

    private void SaveCheatSheetEntry(JsonElement payload)
    {
        var id = GetOptionalGuid(payload, "entryId") ?? Guid.NewGuid();
        var entry = _repository.GetCheatSheetEntry(id) ?? new CheatSheetEntry { Id = id, CreatedAt = DateTime.UtcNow };
        entry.GroupId = GetGuid(payload, "groupId");
        entry.Name = GetString(payload, "name", entry.Name);
        entry.Description = GetString(payload, "description", entry.Description);
        entry.Code = GetString(payload, "code", entry.Code);
        entry.Color = GetColor(payload, "color", entry.Color);
        entry.LastModifiedAt = DateTime.UtcNow;
        _repository.UpsertCheatSheetEntry(entry);
    }

    private void AddAutomationStep(JsonElement payload)
    {
        var automation = _repository.GetAutomation(GetGuid(payload, "automationId")) ?? throw new InvalidOperationException("Automation not found.");
        automation.Steps.Add(new AutomationStep
        {
            ScriptId = GetGuid(payload, "scriptId"),
            ConfigurationId = GetGuid(payload, "configurationId"),
            Order = automation.Steps.Count
        });
        automation.LastModifiedAt = DateTime.UtcNow;
        _repository.UpsertAutomation(automation);
    }

    private void RemoveAutomationStep(JsonElement payload)
    {
        var automation = _repository.GetAutomation(GetGuid(payload, "automationId")) ?? throw new InvalidOperationException("Automation not found.");
        var order = payload.GetProperty("order").GetInt32();
        automation.Steps.RemoveAll(x => x.Order == order);
        var i = 0;
        foreach (var step in automation.Steps.OrderBy(x => x.Order))
        {
            step.Order = i++;
        }
        automation.LastModifiedAt = DateTime.UtcNow;
        _repository.UpsertAutomation(automation);
    }

    private void SaveSettings(JsonElement payload)
    {
        var settings = _repository.GetSettings();
        settings.Theme = GetString(payload, "theme", settings.Theme);
        settings.DefaultTerminal = GetString(payload, "defaultTerminal", settings.DefaultTerminal);
        if (payload.TryGetProperty("openTerminalWindow", out var open))
        {
            settings.OpenTerminalWindow = open.GetBoolean();
        }
        if (payload.TryGetProperty("stopAutomationOnFailure", out var stop))
        {
            settings.StopAutomationOnFailure = stop.GetBoolean();
        }
        _repository.SaveSettings(settings);
        ApplyWindowTheme(settings.Theme);
    }

    private void ApplyWindowTheme(string theme)
    {
        var dark = !theme.Equals("Light", StringComparison.OrdinalIgnoreCase);
        BackColor = dark ? Color.FromArgb(11, 19, 38) : Color.FromArgb(248, 249, 255);
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var useDark = dark ? 1 : 0;
        if (Handle != IntPtr.Zero)
        {
            DwmSetWindowAttribute(Handle, DwmWindowAttributeUseImmersiveDarkMode, ref useDark, sizeof(int));
            DwmSetWindowAttribute(Handle, DwmWindowAttributeUseImmersiveDarkModeBefore20H1, ref useDark, sizeof(int));
            var captionColor = ToColorRef(Color.FromArgb(11, 19, 38));
            var textColor = ToColorRef(Color.White);
            DwmSetWindowAttribute(Handle, DwmWindowAttributeCaptionColor, ref captionColor, sizeof(int));
            DwmSetWindowAttribute(Handle, DwmWindowAttributeTextColor, ref textColor, sizeof(int));
        }
    }

    private void RestoreWindowPlacement(AppSettings settings)
    {
        if (settings.WindowX is null || settings.WindowY is null || settings.WindowWidth is null || settings.WindowHeight is null)
        {
            StartPosition = FormStartPosition.CenterScreen;
            return;
        }

        var bounds = new Rectangle(
            settings.WindowX.Value,
            settings.WindowY.Value,
            Math.Max(settings.WindowWidth.Value, MinimumSize.Width),
            Math.Max(settings.WindowHeight.Value, MinimumSize.Height));

        if (!Screen.AllScreens.Any(screen => screen.WorkingArea.IntersectsWith(bounds)))
        {
            StartPosition = FormStartPosition.CenterScreen;
            return;
        }

        StartPosition = FormStartPosition.Manual;
        Bounds = bounds;
        if (settings.WindowMaximized)
        {
            WindowState = FormWindowState.Maximized;
        }
    }

    private void SaveWindowPlacement()
    {
        var settings = _repository.GetSettings();
        var bounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
        if (bounds.Width < MinimumSize.Width || bounds.Height < MinimumSize.Height)
        {
            return;
        }

        settings.WindowX = bounds.X;
        settings.WindowY = bounds.Y;
        settings.WindowWidth = bounds.Width;
        settings.WindowHeight = bounds.Height;
        settings.WindowMaximized = WindowState == FormWindowState.Maximized;
        _repository.SaveSettings(settings);
    }

    private async Task RefreshUpdateInfoAsync()
    {
        try
        {
            var response = await _httpClient.GetStringAsync(UpdateVersionUrl);
            var latestVersion = ExtractUpdateValue(response, "version", "latestVersion");
            var installerUrl = ExtractUpdateValue(response, "installerUrl", "downloadUrl", "url");
            if (string.IsNullOrWhiteSpace(latestVersion))
            {
                latestVersion = response.Trim().Trim('"');
            }

            if (!TryParseVersion(latestVersion, out var latest))
            {
                _updateInfo = UpdateInfo.NoInfo("Could not parse update version response.");
                return;
            }

            TryParseVersion(GetApplicationVersion(), out var current);
            var status = latest > current ? "OUTDATED" : "UPTODATE";
            _updateInfo = new UpdateInfo(status, latestVersion, NormalizeInstallerUrl(installerUrl), DateTime.UtcNow, null);
        }
        catch (Exception ex)
        {
            _updateInfo = UpdateInfo.NoInfo(ex.Message);
        }
    }

    private async Task DownloadAndRunInstallerAsync()
    {
        if (_updateInfo.Status != "OUTDATED")
        {
            await RefreshUpdateInfoAsync();
        }

        if (_updateInfo.Status != "OUTDATED")
        {
            throw new InvalidOperationException("No newer installer is available.");
        }

        var installerUrl = _updateInfo.InstallerUrl ?? UpdateInstallerFallbackUrl;
        var uri = new Uri(installerUrl, UriKind.Absolute);
        var fileName = Path.GetFileName(uri.LocalPath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = "ScriptManagerSetup.exe";
        }

        var updateDirectory = Path.Combine(_paths.Root, "updates");
        Directory.CreateDirectory(updateDirectory);
        var installerPath = Path.Combine(updateDirectory, fileName);
        var bytes = await _httpClient.GetByteArrayAsync(uri);
        await File.WriteAllBytesAsync(installerPath, bytes);
        Process.Start(new ProcessStartInfo(installerPath) { UseShellExecute = true });
    }

    private void WebViewDragEnter(object? sender, DragEventArgs e)
    {
        e.Effect = e.Data?.GetDataPresent(DataFormats.FileDrop) == true ? DragDropEffects.Copy : DragDropEffects.None;
    }

    private async void WebViewDragDrop(object? sender, DragEventArgs e)
    {
        if (e.Data?.GetData(DataFormats.FileDrop) is not string[] files)
        {
            return;
        }

        foreach (var file in files.Where(File.Exists))
        {
            _library.ImportScript(file);
        }

        await ExecuteFrontendRefreshAsync();
    }

    private async Task ExecuteFrontendRefreshAsync()
    {
        if (_webView.CoreWebView2 is not null)
        {
            await _webView.CoreWebView2.ExecuteScriptAsync("window.ScriptManager && window.ScriptManager.refresh && window.ScriptManager.refresh();");
        }
    }

    private Task ReplyAsync(string id, bool ok, object? data, string? error)
    {
        var json = JsonSerializer.Serialize(new { id, ok, data, error }, JsonOptions);
        _webView.CoreWebView2.PostWebMessageAsJson(json);
        return Task.CompletedTask;
    }

    private sealed record BridgeRequest(string Id, string Action, JsonElement Payload);
    private sealed record UpdateInfo(string Status, string? LatestVersion, string? InstallerUrl, DateTime? CheckedAt, string? Message)
    {
        public static UpdateInfo NoInfo(string? message) => new("NOINFO", null, null, DateTime.UtcNow, message);
    }

    private sealed record BackupManifest(
        DateTime ExportedAt,
        string AppVersion,
        AppSettings Settings,
        IReadOnlyList<ScriptGroup> ScriptGroups,
        IReadOnlyList<ScriptRecord> Scripts,
        IReadOnlyList<AutomationGroup> AutomationGroups,
        IReadOnlyList<AutomationRecord> Automations,
        IReadOnlyList<CheatSheetGroup> CheatSheetGroups,
        IReadOnlyList<CheatSheetEntry> CheatSheetEntries,
        IReadOnlyList<ExecutionLog> Logs);
}
