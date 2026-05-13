namespace ScriptManager.Core;

public sealed class ScriptLibraryService
{
    private const int MaxBackupsPerScript = 10;
    private readonly IScriptRepository _repository;
    private readonly AppPaths _paths;

    public ScriptLibraryService(IScriptRepository repository, AppPaths paths)
    {
        _repository = repository;
        _paths = paths;
        _paths.Ensure();
    }

    public ScriptRecord ImportScript(string sourcePath, Guid? groupId = null, string? name = null)
    {
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException("Script source was not found.", sourcePath);
        }

        var group = ResolveGroup(groupId);
        var script = new ScriptRecord
        {
            GroupId = group.Id,
            Group = group.Name,
            Name = string.IsNullOrWhiteSpace(name) ? Path.GetFileNameWithoutExtension(sourcePath) : name.Trim(),
            Description = "",
            OriginalPath = sourcePath,
            AddedAt = DateTime.UtcNow,
            LastModifiedAt = File.GetLastWriteTimeUtc(sourcePath),
            Status = ScriptSyncStatus.Current
        };
        script.LocalPath = AllocateLocalPath(script.Id, sourcePath);

        File.Copy(sourcePath, script.LocalPath, overwrite: true);
        script.Configurations.Add(new ScriptConfiguration
        {
            Name = "Default",
            WorkingDirectory = Path.GetDirectoryName(sourcePath) ?? Environment.CurrentDirectory
        });
        _repository.UpsertScript(script);
        return script;
    }

    public ScriptRecord CreateScript(string name, string content, string extension = ".ps1", Guid? groupId = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Script name is required.", nameof(name));
        }

        if (!extension.StartsWith('.'))
        {
            extension = "." + extension;
        }

        var group = ResolveGroup(groupId);
        var safeName = SanitizeFileName(name);
        if (string.IsNullOrWhiteSpace(safeName))
        {
            safeName = "script";
        }

        var script = new ScriptRecord
        {
            GroupId = group.Id,
            Group = group.Name,
            Name = name.Trim(),
            Description = "Created inside ScriptManager",
            OriginalPath = "",
            AddedAt = DateTime.UtcNow,
            Status = ScriptSyncStatus.Current
        };
        script.LocalPath = Path.Combine(_paths.Scripts, $"{script.Id:N}-{safeName}{extension}");
        File.WriteAllText(script.LocalPath, content);
        script.LastModifiedAt = File.GetLastWriteTimeUtc(script.LocalPath);
        script.Configurations.Add(new ScriptConfiguration
        {
            Name = "Default",
            WorkingDirectory = Environment.CurrentDirectory
        });
        _repository.UpsertScript(script);
        return script;
    }

    public ScriptSyncStatus CompareAndUpdate(ScriptRecord script)
    {
        script.LastComparedAt = DateTime.UtcNow;

        if (!File.Exists(script.LocalPath))
        {
            script.Status = ScriptSyncStatus.LocalMissing;
            _repository.UpsertScript(script);
            return script.Status;
        }

        if (string.IsNullOrWhiteSpace(script.OriginalPath))
        {
            script.Status = ScriptSyncStatus.Current;
            script.LastModifiedAt = File.GetLastWriteTimeUtc(script.LocalPath);
            _repository.UpsertScript(script);
            return script.Status;
        }

        if (!File.Exists(script.OriginalPath))
        {
            script.Status = ScriptSyncStatus.SourceMissing;
            _repository.UpsertScript(script);
            return script.Status;
        }

        var localTime = File.GetLastWriteTimeUtc(script.LocalPath);
        var sourceTime = File.GetLastWriteTimeUtc(script.OriginalPath);
        if (sourceTime <= localTime)
        {
            script.Status = ScriptSyncStatus.Current;
            script.LastModifiedAt = localTime;
            _repository.UpsertScript(script);
            return script.Status;
        }

        BackupLocalScript(script);
        File.Copy(script.OriginalPath, script.LocalPath, overwrite: true);
        File.SetLastWriteTimeUtc(script.LocalPath, sourceTime);
        script.Status = ScriptSyncStatus.UpdatedFromSource;
        script.LastModifiedAt = sourceTime;
        _repository.UpsertScript(script);
        PruneBackups(script.Id);
        return script.Status;
    }

    public void CompareAndUpdateAll()
    {
        foreach (var script in _repository.GetScripts())
        {
            CompareAndUpdate(script);
        }
    }

    public void AddConfiguration(Guid scriptId, ScriptConfiguration configuration)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        configuration.Order = script.Configurations.Count == 0 ? 0 : script.Configurations.Max(x => x.Order) + 1;
        script.Configurations.Add(configuration);
        _repository.UpsertScript(script);
    }

    public void DeleteConfiguration(Guid scriptId, Guid configurationId)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        script.Configurations.RemoveAll(x => x.Id == configurationId);
        _repository.UpsertScript(script);
    }

    private ScriptGroup ResolveGroup(Guid? groupId)
    {
        var groups = _repository.GetScriptGroups();
        if (groupId.HasValue)
        {
            var found = groups.FirstOrDefault(x => x.Id == groupId.Value);
            if (found is not null)
            {
                return found;
            }
        }

        var group = groups.FirstOrDefault(x => x.Name == "Default") ?? new ScriptGroup { Name = "Default" };
        _repository.UpsertScriptGroup(group);
        return group;
    }

    private string AllocateLocalPath(Guid scriptId, string sourcePath)
    {
        var extension = Path.GetExtension(sourcePath);
        var sourceName = SanitizeFileName(Path.GetFileNameWithoutExtension(sourcePath));
        if (string.IsNullOrWhiteSpace(sourceName))
        {
            sourceName = "script";
        }

        return Path.Combine(_paths.Scripts, $"{scriptId:N}-{sourceName}{extension}");
    }

    private void BackupLocalScript(ScriptRecord script)
    {
        var backupDirectory = Path.Combine(_paths.Backups, script.Id.ToString("N"));
        Directory.CreateDirectory(backupDirectory);
        var backupName = $"{DateTime.UtcNow:yyyyMMdd-HHmmssfff}-{Path.GetFileName(script.LocalPath)}";
        File.Copy(script.LocalPath, Path.Combine(backupDirectory, backupName), overwrite: false);
    }

    private void PruneBackups(Guid scriptId)
    {
        var backupDirectory = Path.Combine(_paths.Backups, scriptId.ToString("N"));
        if (!Directory.Exists(backupDirectory))
        {
            return;
        }

        foreach (var file in Directory.GetFiles(backupDirectory).OrderByDescending(File.GetCreationTimeUtc).Skip(MaxBackupsPerScript))
        {
            File.Delete(file);
        }
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(name.Select(ch => invalid.Contains(ch) ? '-' : ch)).Trim('-', ' ');
    }
}
