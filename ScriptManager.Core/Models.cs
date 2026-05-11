namespace ScriptManager.Core;

public enum ScriptSyncStatus
{
    Unknown,
    Current,
    UpdatedFromSource,
    SourceMissing,
    LocalMissing,
    SourceOlderOrSame,
    Error
}

public enum ExecutionResult
{
    Success,
    Failed,
    Cancelled,
    Skipped
}

public enum ExecutionType
{
    Script,
    Automation
}

public sealed class ScriptGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "Default";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "#4fdbc8";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ScriptRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "code";
    public string Color { get; set; } = "#c0c1ff";
    public string OriginalPath { get; set; } = "";
    public string LocalPath { get; set; } = "";
    public string Group { get; set; } = "Default";
    public ScriptSyncStatus Status { get; set; } = ScriptSyncStatus.Unknown;
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastComparedAt { get; set; }
    public List<ScriptConfiguration> Configurations { get; set; } = [];
}

public sealed class ScriptConfiguration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "Default";
    public string Description { get; set; } = "";
    public string WorkingDirectory { get; set; } = "";
    public bool RunAsAdmin { get; set; }
    public int Order { get; set; }
    public List<ScriptParameter> Parameters { get; set; } = [];
}

public sealed class ScriptParameter
{
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
}

public sealed class AutomationGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "Default";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "#ffb783";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class AutomationRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public string Group { get; set; } = "Default";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "flow";
    public string Color { get; set; } = "#8083ff";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;
    public List<AutomationStep> Steps { get; set; } = [];
}

public sealed class CheatSheetGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "General";
    public string Color { get; set; } = "#4fdbc8";
    public string Icon { get; set; } = "book_ribbon";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class CheatSheetEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "#c0c1ff";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;
}

public sealed class AutomationStep
{
    public Guid ScriptId { get; set; }
    public Guid ConfigurationId { get; set; }
    public int Order { get; set; }
}

public sealed class ExecutionLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime FinishedAt { get; set; } = DateTime.UtcNow;
    public ExecutionResult Result { get; set; }
    public ExecutionType Type { get; set; }
    public string Name { get; set; } = "";
    public string Configuration { get; set; } = "";
    public string CommandLine { get; set; } = "";
    public string WorkingDirectory { get; set; } = "";
    public int ExitCode { get; set; }
    public string TerminalOutput { get; set; } = "";
    public List<ExecutionStepLog> Steps { get; set; } = [];
}

public sealed class ExecutionStepLog
{
    public Guid ScriptId { get; set; }
    public Guid ConfigurationId { get; set; }
    public string ScriptName { get; set; } = "";
    public string ConfigurationName { get; set; } = "";
    public ExecutionResult Result { get; set; } = ExecutionResult.Skipped;
    public int ExitCode { get; set; }
    public string Output { get; set; } = "";
}

public sealed class AppSettings
{
    public Guid Id { get; set; } = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public string Theme { get; set; } = "Dark";
    public string DefaultTerminal { get; set; } = "Auto";
    public bool OpenTerminalWindow { get; set; }
    public bool StopAutomationOnFailure { get; set; } = true;
    public string SuccessExitCodesCsv { get; set; } = "0";
    public int? WindowX { get; set; }
    public int? WindowY { get; set; }
    public int? WindowWidth { get; set; }
    public int? WindowHeight { get; set; }
    public bool WindowMaximized { get; set; }
}
