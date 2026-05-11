namespace ScriptManager.Core;

public sealed class EnvironmentVariableService
{
    public IReadOnlyList<EnvironmentVariableEntry> Get(EnvironmentVariableTarget target)
    {
        return Environment.GetEnvironmentVariables(target)
            .Keys
            .Cast<string>()
            .OrderBy(x => x)
            .Select(name => new EnvironmentVariableEntry(name, Environment.GetEnvironmentVariable(name, target) ?? "", target))
            .ToList();
    }

    public void Set(string name, string value, EnvironmentVariableTarget target)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        Environment.SetEnvironmentVariable(name.Trim(), value, target);
    }
}

public sealed record EnvironmentVariableEntry(string Name, string Value, EnvironmentVariableTarget Target);
