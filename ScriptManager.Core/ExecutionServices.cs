using System.Diagnostics;
using System.Text;

namespace ScriptManager.Core;

public sealed class ScriptExecutionService
{
    private readonly IScriptRepository _repository;
    private readonly ScriptLibraryService _library;

    public ScriptExecutionService(IScriptRepository repository, ScriptLibraryService library)
    {
        _repository = repository;
        _library = library;
    }

    public async Task<ExecutionLog> RunScriptAsync(Guid scriptId, Guid configurationId, CancellationToken cancellationToken = default)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        var configuration = script.Configurations.FirstOrDefault(x => x.Id == configurationId) ?? throw new InvalidOperationException("Configuration not found.");
        _library.CompareAndUpdate(script);

        var started = DateTime.UtcNow;
        var command = BuildCommand(script.LocalPath, configuration);
        var result = await ExecuteAsync(script.LocalPath, configuration, cancellationToken);
        var log = new ExecutionLog
        {
            StartedAt = started,
            FinishedAt = DateTime.UtcNow,
            Result = result.ExitCode == 0 ? ExecutionResult.Success : ExecutionResult.Failed,
            Type = ExecutionType.Script,
            Name = script.Name,
            Configuration = configuration.Name,
            CommandLine = command,
            WorkingDirectory = configuration.WorkingDirectory,
            ExitCode = result.ExitCode,
            TerminalOutput = result.Output
        };
        _repository.AddLog(log);
        return log;
    }

    public async Task<ExecutionLog> RunAutomationAsync(Guid automationId, CancellationToken cancellationToken = default)
    {
        var automation = _repository.GetAutomation(automationId) ?? throw new InvalidOperationException("Automation not found.");
        var started = DateTime.UtcNow;
        var log = new ExecutionLog
        {
            StartedAt = started,
            Type = ExecutionType.Automation,
            Name = automation.Name,
            Result = ExecutionResult.Success
        };

        var output = new StringBuilder();
        foreach (var step in automation.Steps.OrderBy(x => x.Order))
        {
            var script = _repository.GetScript(step.ScriptId);
            var configuration = script?.Configurations.FirstOrDefault(x => x.Id == step.ConfigurationId);
            if (script is null || configuration is null)
            {
                log.Result = ExecutionResult.Failed;
                log.Steps.Add(new ExecutionStepLog
                {
                    ScriptId = step.ScriptId,
                    ConfigurationId = step.ConfigurationId,
                    Result = ExecutionResult.Failed,
                    Output = "Script or configuration was not found."
                });
                break;
            }

            _library.CompareAndUpdate(script);
            var result = await ExecuteAsync(script.LocalPath, configuration, cancellationToken);
            var stepResult = result.ExitCode == 0 ? ExecutionResult.Success : ExecutionResult.Failed;
            log.Steps.Add(new ExecutionStepLog
            {
                ScriptId = script.Id,
                ConfigurationId = configuration.Id,
                ScriptName = script.Name,
                ConfigurationName = configuration.Name,
                Result = stepResult,
                ExitCode = result.ExitCode,
                Output = result.Output
            });
            output.AppendLine($"> {BuildCommand(script.LocalPath, configuration)}");
            output.AppendLine(result.Output);

            if (stepResult != ExecutionResult.Success)
            {
                log.Result = ExecutionResult.Failed;
                break;
            }
        }

        log.FinishedAt = DateTime.UtcNow;
        log.TerminalOutput = output.ToString();
        log.ExitCode = log.Steps.LastOrDefault()?.ExitCode ?? 0;
        _repository.AddLog(log);
        return log;
    }

    public static string DetectTerminal()
    {
        if (CommandExists("pwsh")) return "pwsh";
        if (CommandExists("powershell")) return "powershell";
        if (CommandExists("wt")) return "wt";
        return "cmd";
    }

    public static string BuildCommand(string scriptPath, ScriptConfiguration configuration)
    {
        var args = string.Join(" ", configuration.Parameters.Select(p => $"-{p.Name} \"{p.Value.Replace("\"", "\\\"")}\""));
        return $"pwsh -ExecutionPolicy Bypass -File \"{scriptPath}\" {args}".TrimEnd();
    }

    private static async Task<(int ExitCode, string Output)> ExecuteAsync(string scriptPath, ScriptConfiguration configuration, CancellationToken cancellationToken)
    {
        var shell = DetectTerminal();
        if (shell == "wt")
        {
            shell = "powershell";
        }

        var psi = new ProcessStartInfo
        {
            FileName = shell == "cmd" ? "cmd.exe" : shell,
            WorkingDirectory = Directory.Exists(configuration.WorkingDirectory) ? configuration.WorkingDirectory : Environment.CurrentDirectory,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        if (shell == "cmd")
        {
            psi.ArgumentList.Add("/c");
            psi.ArgumentList.Add(scriptPath);
        }
        else
        {
            psi.ArgumentList.Add("-NoProfile");
            psi.ArgumentList.Add("-ExecutionPolicy");
            psi.ArgumentList.Add("Bypass");
            psi.ArgumentList.Add("-File");
            psi.ArgumentList.Add(scriptPath);
            foreach (var parameter in configuration.Parameters.Where(x => !string.IsNullOrWhiteSpace(x.Name)))
            {
                psi.ArgumentList.Add("-" + parameter.Name);
                psi.ArgumentList.Add(parameter.Value);
            }
        }

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Could not start script process.");
        var stdout = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        return (process.ExitCode, (await stdout) + (await stderr));
    }

    private static bool CommandExists(string command)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "where.exe",
                ArgumentList = { command },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            process?.WaitForExit(1500);
            return process?.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }
}
