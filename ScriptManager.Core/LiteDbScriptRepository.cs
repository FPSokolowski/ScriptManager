using LiteDB;

namespace ScriptManager.Core;

public sealed class LiteDbScriptRepository : IScriptRepository
{
    private readonly LiteDatabase _database;

    public LiteDbScriptRepository(string databasePath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
        _database = new LiteDatabase(databasePath);
        Seed();
    }

    public IReadOnlyList<ScriptGroup> GetScriptGroups() => _database.GetCollection<ScriptGroup>("scriptGroups").FindAll().OrderBy(x => x.Name).ToList();
    public void UpsertScriptGroup(ScriptGroup group) => _database.GetCollection<ScriptGroup>("scriptGroups").Upsert(group);
    public void DeleteScriptGroup(Guid id) => _database.GetCollection<ScriptGroup>("scriptGroups").Delete(id);

    public IReadOnlyList<ScriptRecord> GetScripts() => _database.GetCollection<ScriptRecord>("scripts").FindAll().OrderBy(x => x.Group).ThenBy(x => x.Name).ToList();
    public ScriptRecord? GetScript(Guid id) => _database.GetCollection<ScriptRecord>("scripts").FindById(id);
    public void UpsertScript(ScriptRecord script) => _database.GetCollection<ScriptRecord>("scripts").Upsert(script);
    public void DeleteScript(Guid id) => _database.GetCollection<ScriptRecord>("scripts").Delete(id);

    public IReadOnlyList<AutomationGroup> GetAutomationGroups() => _database.GetCollection<AutomationGroup>("automationGroups").FindAll().OrderBy(x => x.Name).ToList();
    public void UpsertAutomationGroup(AutomationGroup group) => _database.GetCollection<AutomationGroup>("automationGroups").Upsert(group);
    public void DeleteAutomationGroup(Guid id) => _database.GetCollection<AutomationGroup>("automationGroups").Delete(id);

    public IReadOnlyList<AutomationRecord> GetAutomations() => _database.GetCollection<AutomationRecord>("automations").FindAll().OrderBy(x => x.Group).ThenBy(x => x.Name).ToList();
    public AutomationRecord? GetAutomation(Guid id) => _database.GetCollection<AutomationRecord>("automations").FindById(id);
    public void UpsertAutomation(AutomationRecord automation) => _database.GetCollection<AutomationRecord>("automations").Upsert(automation);
    public void DeleteAutomation(Guid id) => _database.GetCollection<AutomationRecord>("automations").Delete(id);

    public IReadOnlyList<ExecutionLog> GetLogs(int take = 500) =>
        _database.GetCollection<ExecutionLog>("logs")
            .FindAll()
            .OrderByDescending(x => x.StartedAt)
            .Take(take)
            .ToList();

    public void AddLog(ExecutionLog log) => _database.GetCollection<ExecutionLog>("logs").Insert(log);

    public IReadOnlyList<CheatSheetGroup> GetCheatSheetGroups() =>
        _database.GetCollection<CheatSheetGroup>("cheatSheetGroups").FindAll().OrderBy(x => x.Name).ToList();

    public CheatSheetGroup? GetCheatSheetGroup(Guid id) => _database.GetCollection<CheatSheetGroup>("cheatSheetGroups").FindById(id);
    public void UpsertCheatSheetGroup(CheatSheetGroup group) => _database.GetCollection<CheatSheetGroup>("cheatSheetGroups").Upsert(group);
    public void DeleteCheatSheetGroup(Guid id)
    {
        _database.GetCollection<CheatSheetEntry>("cheatSheetEntries").DeleteMany(x => x.GroupId == id);
        _database.GetCollection<CheatSheetGroup>("cheatSheetGroups").Delete(id);
    }

    public IReadOnlyList<CheatSheetEntry> GetCheatSheetEntries() =>
        _database.GetCollection<CheatSheetEntry>("cheatSheetEntries").FindAll().OrderBy(x => x.Name).ToList();

    public CheatSheetEntry? GetCheatSheetEntry(Guid id) => _database.GetCollection<CheatSheetEntry>("cheatSheetEntries").FindById(id);
    public void UpsertCheatSheetEntry(CheatSheetEntry entry) => _database.GetCollection<CheatSheetEntry>("cheatSheetEntries").Upsert(entry);
    public void DeleteCheatSheetEntry(Guid id) => _database.GetCollection<CheatSheetEntry>("cheatSheetEntries").Delete(id);

    public AppSettings GetSettings()
    {
        var collection = _database.GetCollection<AppSettings>("settings");
        return collection.FindById(AppSettingsId) ?? new AppSettings();
    }

    public void SaveSettings(AppSettings settings)
    {
        settings.Id = AppSettingsId;
        _database.GetCollection<AppSettings>("settings").Upsert(settings);
    }

    public void Dispose() => _database.Dispose();

    private static Guid AppSettingsId => Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private void Seed()
    {
        if (!GetScriptGroups().Any())
        {
            UpsertScriptGroup(new ScriptGroup { Name = "Default", Description = "Ungrouped scripts" });
        }

        if (!GetAutomationGroups().Any())
        {
            UpsertAutomationGroup(new AutomationGroup { Name = "Default", Description = "Ungrouped automations" });
        }

        if (!GetCheatSheetGroups().Any())
        {
            UpsertCheatSheetGroup(new CheatSheetGroup { Name = "General", Color = "#4fdbc8" });
        }

        SaveSettings(GetSettings());
    }
}
