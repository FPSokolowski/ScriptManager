namespace ScriptManager.Core;

public interface IScriptRepository : IDisposable
{
    IReadOnlyList<ScriptGroup> GetScriptGroups();
    void UpsertScriptGroup(ScriptGroup group);
    void DeleteScriptGroup(Guid id);

    IReadOnlyList<ScriptRecord> GetScripts();
    ScriptRecord? GetScript(Guid id);
    void UpsertScript(ScriptRecord script);
    void DeleteScript(Guid id);

    IReadOnlyList<AutomationGroup> GetAutomationGroups();
    void UpsertAutomationGroup(AutomationGroup group);
    void DeleteAutomationGroup(Guid id);

    IReadOnlyList<AutomationRecord> GetAutomations();
    AutomationRecord? GetAutomation(Guid id);
    void UpsertAutomation(AutomationRecord automation);
    void DeleteAutomation(Guid id);

    IReadOnlyList<ExecutionLog> GetLogs(int take = 500);
    void AddLog(ExecutionLog log);

    IReadOnlyList<CheatSheetGroup> GetCheatSheetGroups();
    CheatSheetGroup? GetCheatSheetGroup(Guid id);
    void UpsertCheatSheetGroup(CheatSheetGroup group);
    void DeleteCheatSheetGroup(Guid id);

    IReadOnlyList<CheatSheetEntry> GetCheatSheetEntries();
    CheatSheetEntry? GetCheatSheetEntry(Guid id);
    void UpsertCheatSheetEntry(CheatSheetEntry entry);
    void DeleteCheatSheetEntry(Guid id);
    void ReorderCheatSheetEntries(Guid groupId, IReadOnlyList<Guid> entryIds);

    AppSettings GetSettings();
    void SaveSettings(AppSettings settings);
}
