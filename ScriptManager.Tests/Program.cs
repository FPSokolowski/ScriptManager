using ScriptManager.Core;

var tests = new List<(string Name, Func<Task> Run)>
{
    ("Import copies script and stores source metadata", TestImportCopiesScript),
    ("CreateScript creates local script with default configuration", TestCreateScript),
    ("CompareAndUpdate refreshes newer source and keeps 10 backups", TestSyncAndBackupRotation),
    ("LiteDB repository persists groups, scripts, automations and settings", TestRepositoryCrud),
    ("Automation stops after first failing script and logs skipped tail", TestAutomationStopsOnFailure),
    ("Smoke: services can initialize and compare all", TestSmokeInitialize)
};

var failed = 0;
foreach (var test in tests)
{
    try
    {
        await test.Run();
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception ex)
    {
        failed++;
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"FAIL {test.Name}");
        Console.ResetColor();
        Console.WriteLine(ex);
    }
}

Console.ResetColor();
if (failed > 0)
{
    Environment.Exit(1);
}

static async Task TestImportCopiesScript()
{
    using var fixture = new Fixture();
    var source = fixture.WriteSource("hello.ps1", "Write-Output 'hello'");
    var script = fixture.Library.ImportScript(source);
    Assert(File.Exists(script.LocalPath), "local copy should exist");
    Assert(script.OriginalPath == source, "source path should be stored");
    Assert(script.Configurations.Count == 1, "default configuration should be created");
    await Task.CompletedTask;
}

static async Task TestCreateScript()
{
    using var fixture = new Fixture();
    var script = fixture.Library.CreateScript("Local build", "Write-Output 'build'");
    Assert(string.IsNullOrWhiteSpace(script.OriginalPath), "local script should not have source path");
    Assert(await File.ReadAllTextAsync(script.LocalPath) == "Write-Output 'build'", "content should be written");
}

static async Task TestSyncAndBackupRotation()
{
    using var fixture = new Fixture();
    var source = fixture.WriteSource("sync.ps1", "Write-Output 1");
    var script = fixture.Library.ImportScript(source);
    for (var i = 0; i < 12; i++)
    {
        await Task.Delay(20);
        await File.WriteAllTextAsync(source, $"Write-Output {i + 2}");
        File.SetLastWriteTimeUtc(source, DateTime.UtcNow.AddMinutes(i + 1));
        var status = fixture.Library.CompareAndUpdate(script);
        Assert(status == ScriptSyncStatus.UpdatedFromSource, "newer source should update local copy");
    }

    var backupDir = Path.Combine(fixture.Paths.Backups, script.Id.ToString("N"));
    Assert(Directory.GetFiles(backupDir).Length == 10, "backup rotation should keep max 10 files");
    Assert((await File.ReadAllTextAsync(script.LocalPath)).Contains("13"), "latest source should be copied");
}

static async Task TestRepositoryCrud()
{
    using var fixture = new Fixture();
    var group = new ScriptGroup { Name = "Ops" };
    fixture.Repository.UpsertScriptGroup(group);
    Assert(fixture.Repository.GetScriptGroups().Any(x => x.Name == "Ops"), "script group should persist");
    var automationGroup = new AutomationGroup { Name = "Release" };
    fixture.Repository.UpsertAutomationGroup(automationGroup);
    var automation = new AutomationRecord { Name = "Deploy", GroupId = automationGroup.Id, Group = automationGroup.Name };
    fixture.Repository.UpsertAutomation(automation);
    Assert(fixture.Repository.GetAutomation(automation.Id)?.Name == "Deploy", "automation should persist");
    var settings = fixture.Repository.GetSettings();
    settings.Theme = "Light";
    settings.WindowX = 120;
    settings.WindowY = 80;
    settings.WindowWidth = 900;
    settings.WindowHeight = 640;
    settings.WindowMaximized = true;
    fixture.Repository.SaveSettings(settings);
    var savedSettings = fixture.Repository.GetSettings();
    Assert(savedSettings.Theme == "Light", "settings should persist");
    Assert(savedSettings.WindowX == 120 && savedSettings.WindowY == 80, "window position should persist");
    Assert(savedSettings.WindowWidth == 900 && savedSettings.WindowHeight == 640, "window size should persist");
    Assert(savedSettings.WindowMaximized, "window maximized state should persist");
    await Task.CompletedTask;
}

static async Task TestAutomationStopsOnFailure()
{
    using var fixture = new Fixture();
    var good = fixture.Library.CreateScript("good", "Write-Output 'good'; exit 0");
    var bad = fixture.Library.CreateScript("bad", "Write-Error 'bad'; exit 7");
    var tail = fixture.Library.CreateScript("tail", "Write-Output 'tail'; exit 0");
    var group = fixture.Repository.GetAutomationGroups().First();
    var automation = new AutomationRecord { Name = "Chain", GroupId = group.Id, Group = group.Name };
    automation.Steps.Add(new AutomationStep { ScriptId = good.Id, ConfigurationId = good.Configurations[0].Id, Order = 0 });
    automation.Steps.Add(new AutomationStep { ScriptId = bad.Id, ConfigurationId = bad.Configurations[0].Id, Order = 1 });
    automation.Steps.Add(new AutomationStep { ScriptId = tail.Id, ConfigurationId = tail.Configurations[0].Id, Order = 2 });
    fixture.Repository.UpsertAutomation(automation);

    var log = await fixture.Execution.RunAutomationAsync(automation.Id);
    Assert(log.Result == ExecutionResult.Failed, "automation should fail");
    Assert(log.Steps.Count == 2, "automation should stop before tail step");
    Assert(log.Steps.Last().ExitCode == 7, "failing exit code should be logged");
}

static async Task TestSmokeInitialize()
{
    using var fixture = new Fixture();
    fixture.Library.CompareAndUpdateAll();
    fixture.Repository.AddLog(new ExecutionLog { Name = "smoke", Result = ExecutionResult.Success });
    Assert(fixture.Repository.GetLogs().Any(x => x.Name == "smoke"), "log should be readable");
    await Task.CompletedTask;
}

static void Assert(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}

internal sealed class Fixture : IDisposable
{
    public Fixture()
    {
        Root = Path.Combine(Path.GetTempPath(), "ScriptManagerTests", Guid.NewGuid().ToString("N"));
        SourceRoot = Path.Combine(Root, "source");
        Directory.CreateDirectory(SourceRoot);
        Paths = new AppPaths(Path.Combine(Root, "app"));
        Paths.Ensure();
        Repository = new LiteDbScriptRepository(Paths.DatabasePath);
        Library = new ScriptLibraryService(Repository, Paths);
        Execution = new ScriptExecutionService(Repository, Library);
    }

    public string Root { get; }
    public string SourceRoot { get; }
    public AppPaths Paths { get; }
    public LiteDbScriptRepository Repository { get; }
    public ScriptLibraryService Library { get; }
    public ScriptExecutionService Execution { get; }

    public string WriteSource(string name, string content)
    {
        var path = Path.Combine(SourceRoot, name);
        File.WriteAllText(path, content);
        return path;
    }

    public void Dispose()
    {
        Repository.Dispose();
        if (Directory.Exists(Root))
        {
            Directory.Delete(Root, recursive: true);
        }
    }
}
