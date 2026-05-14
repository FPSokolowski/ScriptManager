using System.Diagnostics;
using System.Text;

namespace ScriptManager.Core;

public sealed class ScriptExecutionService
{
    private readonly IScriptRepository _repository;
    private readonly ScriptLibraryService _library;
    private readonly AppPaths _paths;

    public ScriptExecutionService(IScriptRepository repository, ScriptLibraryService library, AppPaths? paths = null)
    {
        _repository = repository;
        _library = library;
        _paths = paths ?? AppPaths.ForCurrentUser();
    }

    public IReadOnlyList<PreparedCommand> PrepareScriptRun(Guid scriptId, Guid? configurationId)
    {
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        var configuration = ResolveConfiguration(script, configurationId);
        return
        [
            new PreparedCommand(script.Id, configuration.Id, script.Name, configuration.Name, configuration.WorkingDirectory, BuildCommand(script.LocalPath, configuration))
        ];
    }

    public IReadOnlyList<PreparedCommand> PrepareAutomationRun(Guid automationId)
    {
        var automation = _repository.GetAutomation(automationId) ?? throw new InvalidOperationException("Automation not found.");
        var commands = new List<PreparedCommand>();
        foreach (var step in automation.Steps.OrderBy(x => x.Order))
        {
            if (step.Kind != AutomationStepKind.Script)
            {
                commands.Add(new PreparedCommand(Guid.Empty, Guid.Empty, step.Kind.ToString(), "", "", DescribeSpecialStep(step)));
                continue;
            }
            var script = step.ScriptId is Guid scriptId ? _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.") : throw new InvalidOperationException("Script not found.");
            var configuration = step.ConfigurationId is Guid configurationId ? script.Configurations.FirstOrDefault(x => x.Id == configurationId) ?? throw new InvalidOperationException("Configuration not found.") : throw new InvalidOperationException("Configuration not found.");
            commands.Add(new PreparedCommand(script.Id, configuration.Id, script.Name, configuration.Name, configuration.WorkingDirectory, BuildCommand(script.LocalPath, configuration)));
        }

        return commands;
    }

    public async Task<ExecutionLog> RunScriptAsync(Guid scriptId, Guid? configurationId, bool visibleTerminal = false, RunExecutionOptions? options = null, CancellationToken cancellationToken = default)
    {
        options ??= RunExecutionOptions.Default;
        var script = _repository.GetScript(scriptId) ?? throw new InvalidOperationException("Script not found.");
        var configuration = ResolveConfiguration(script, configurationId);
        _library.CompareAndUpdate(script);

        var command = BuildCommand(script.LocalPath, configuration);
        var log = new ExecutionLog
        {
            Type = ExecutionType.Script,
            Name = script.Name,
            Configuration = configuration.Name,
            CommandLine = command,
            WorkingDirectory = configuration.WorkingDirectory
        };
        log.StartedAt = DateTime.UtcNow;
        var result = await ExecuteAsync(script.Id, log.Id, script.Name, ExecutionType.Script, script.LocalPath, configuration, visibleTerminal, options, false, cancellationToken);
        log.FinishedAt = DateTime.UtcNow;
        log.Result = result.ExitCode == 0 ? ExecutionResult.Success : ExecutionResult.Failed;
        log.ExitCode = result.ExitCode;
        log.TerminalOutput = result.Output;
        _repository.AddLog(log);
        return log;
    }

    public async Task<ExecutionLog> RunAutomationAsync(Guid automationId, bool visibleTerminal = false, RunExecutionOptions? options = null, CancellationToken cancellationToken = default)
    {
        options ??= RunExecutionOptions.Default;
        var automation = _repository.GetAutomation(automationId) ?? throw new InvalidOperationException("Automation not found.");
        if (visibleTerminal)
        {
            return await RunAutomationVisibleAsync(automation, options, cancellationToken);
        }

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
            if (step.Kind != AutomationStepKind.Script)
            {
                output.AppendLine(DescribeSpecialStep(step));
                continue;
            }
            var script = step.ScriptId is Guid scriptId ? _repository.GetScript(scriptId) : null;
            var configuration = step.ConfigurationId is Guid configurationId ? script?.Configurations.FirstOrDefault(x => x.Id == configurationId) : null;
            if (script is null || configuration is null)
            {
                log.Result = ExecutionResult.Failed;
                log.Steps.Add(new ExecutionStepLog
                {
                    ScriptId = step.ScriptId ?? Guid.Empty,
                    ConfigurationId = step.ConfigurationId ?? Guid.Empty,
                    Result = ExecutionResult.Failed,
                    Output = "Script or configuration was not found."
                });
                break;
            }

            _library.CompareAndUpdate(script);
            var result = await ExecuteAsync(script.Id, log.Id, script.Name, ExecutionType.Script, script.LocalPath, configuration, false, options, false, cancellationToken);
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
        var args = string.Join(" ", configuration.Parameters.Select(FormatParameter));
        return $"pwsh -ExecutionPolicy Bypass -File \"{scriptPath}\" {args}".TrimEnd();
    }

    private async Task<(int ExitCode, string Output)> ExecuteAsync(Guid actionId, Guid logId, string actionName, ExecutionType type, string scriptPath, ScriptConfiguration configuration, bool visibleTerminal, RunExecutionOptions options, bool tryContinueEvenIfFail, CancellationToken cancellationToken)
    {
        return visibleTerminal
            ? await ExecuteVisibleAsync(actionId, logId, actionName, type, scriptPath, configuration, options, tryContinueEvenIfFail, cancellationToken)
            : await ExecuteHiddenAsync(scriptPath, configuration, cancellationToken);
    }

    private static async Task<(int ExitCode, string Output)> ExecuteHiddenAsync(string scriptPath, ScriptConfiguration configuration, CancellationToken cancellationToken)
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
                if (string.IsNullOrEmpty(parameter.Value))
                {
                    psi.ArgumentList.Add(parameter.Name);
                }
                else
                {
                    psi.ArgumentList.Add("-" + parameter.Name);
                    psi.ArgumentList.Add(parameter.Value);
                }
            }
        }

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Could not start script process.");
        var stdout = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderr = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        return (process.ExitCode, (await stdout) + (await stderr));
    }

    private async Task<ExecutionLog> RunAutomationVisibleAsync(AutomationRecord automation, RunExecutionOptions options, CancellationToken cancellationToken)
    {
        var started = DateTime.UtcNow;
        var log = new ExecutionLog
        {
            StartedAt = started,
            Type = ExecutionType.Automation,
            Name = automation.Name,
            Result = ExecutionResult.Success
        };

        var steps = new List<(ScriptRecord? Script, ScriptConfiguration? Configuration, AutomationStep Step)>();
        foreach (var step in automation.Steps.OrderBy(x => x.Order))
        {
            if (step.Kind != AutomationStepKind.Script)
            {
                steps.Add((null, null, step));
                continue;
            }
            var script = step.ScriptId is Guid scriptId ? _repository.GetScript(scriptId) : null;
            var configuration = step.ConfigurationId is Guid configurationId ? script?.Configurations.FirstOrDefault(x => x.Id == configurationId) : null;
            if (script is null || configuration is null)
            {
                log.Result = ExecutionResult.Failed;
                log.Steps.Add(new ExecutionStepLog
                {
                    ScriptId = step.ScriptId ?? Guid.Empty,
                    ConfigurationId = step.ConfigurationId ?? Guid.Empty,
                    Result = ExecutionResult.Failed,
                    Output = "Script or configuration was not found."
                });
                log.FinishedAt = DateTime.UtcNow;
                _repository.AddLog(log);
                return log;
            }

            _library.CompareAndUpdate(script);
            steps.Add((script, configuration, step));
        }

        var result = await ExecuteAutomationVisibleAsync(automation.Id, log.Id, automation.Name, steps, options with { TryContinueEvenIfFail = automation.TryContinueEvenIfFail }, cancellationToken);
        log.TerminalOutput = result.Output;
        log.ExitCode = result.ExitCode;
        log.Result = result.ExitCode == 0 ? ExecutionResult.Success : ExecutionResult.Failed;
        foreach (var step in steps.Where(x => x.Script is not null && x.Configuration is not null))
        {
            var marker = $"__SM_STEP_EXIT|{step.Script!.Id:N}|{step.Configuration!.Id:N}|";
            var exitCode = ExtractStepExitCode(result.Output, marker);
            var stepResult = exitCode == 0 ? ExecutionResult.Success : ExecutionResult.Failed;
            log.Steps.Add(new ExecutionStepLog
            {
                ScriptId = step.Script.Id,
                ConfigurationId = step.Configuration.Id,
                ScriptName = step.Script.Name,
                ConfigurationName = step.Configuration.Name,
                Result = stepResult,
                ExitCode = exitCode,
                Output = ""
            });
            if (stepResult == ExecutionResult.Failed)
            {
                break;
            }
        }

        log.FinishedAt = DateTime.UtcNow;
        _repository.AddLog(log);
        return log;
    }

    private async Task<(int ExitCode, string Output)> ExecuteAutomationVisibleAsync(Guid actionId, Guid logId, string actionName, IReadOnlyList<(ScriptRecord? Script, ScriptConfiguration? Configuration, AutomationStep Step)> steps, RunExecutionOptions options, CancellationToken cancellationToken)
    {
        var logPath = BuildOutputLogPath(options.OutputLogDirectory, logId, actionName, ExecutionType.Automation);
        var wrapperPath = Path.Combine(Path.GetTempPath(), $"scriptmanager-{Guid.NewGuid():N}.ps1");
        var builder = new StringBuilder();
        AppendWrapperHeader(builder, logPath, ExecutionType.Automation, actionName, actionId, logId);
        builder.AppendLine("function Invoke-SmStep([string]$Path, [string]$Working, [string[]]$ArgsList, [string]$Marker) {");
        builder.AppendLine("  if ($Working -and (Test-Path -LiteralPath $Working)) { Push-Location -LiteralPath $Working }");
        builder.AppendLine("  try {");
        builder.AppendLine("    & $Path @ArgsList 2>&1 | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("    $code = $LASTEXITCODE; if ($null -eq $code) { $code = 0 }");
        builder.AppendLine("  } catch { $_ | Tee-Object -FilePath $__smLog -Append; $code = 1 }");
        builder.AppendLine("  finally { if ($Working -and (Test-Path -LiteralPath $Working)) { Pop-Location } }");
        builder.AppendLine("  $line = \"$Marker$code\"; $line | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  return $code");
        builder.AppendLine("}");
        builder.AppendLine($"$__smTryContinueEvenIfFail = ${options.TryContinueEvenIfFail.ToString().ToLowerInvariant()}");
        for (var index = 0; index < steps.Count; index++)
        {
            var step = steps[index];
            if (step.Step.Kind != AutomationStepKind.Script)
            {
                AppendSpecialStep(builder, step.Step);
                continue;
            }
            if (step.Script is null || step.Configuration is null)
            {
                continue;
            }
            var marker = $"__SM_STEP_EXIT|{step.Script.Id:N}|{step.Configuration.Id:N}|";
            builder.AppendLine("if (-not $__smStop) {");
            builder.AppendLine($"  $__smMarker = {PsString(marker)}");
            if (index > 0 && options.ShouldWaitBetweenScripts)
            {
                builder.AppendLine($"  Start-Sleep -Milliseconds {Math.Clamp(options.WaitBetweenScriptsMilliseconds, 1, 86_400_000)}");
            }
            if (index > 0 && options.ConfirmationBetweenScripts)
            {
                builder.AppendLine("  $__smPromptStarted = Get-Date");
                builder.AppendLine("  $confirmation = Read-Host 'Continue with next script? Press Enter or type Y/yes to continue'");
                builder.AppendLine("  $__smPromptSeconds += ((Get-Date) - $__smPromptStarted).TotalSeconds");
                builder.AppendLine("  if ($confirmation -notin @('', 'Y','y','YES','yes','Yes')) { $__smExit = 130; $__smStop = $true; \"$__smMarker$__smExit\" | Tee-Object -FilePath $__smLog -Append }");
            }
            builder.AppendLine("}");
            builder.AppendLine("if (-not $__smStop) {");
            builder.AppendLine($"  $__smCommand = '> {EscapeForSingleQuoted(BuildCommand(step.Script.LocalPath, step.Configuration))}'");
            builder.AppendLine("  Write-Host $__smCommand -ForegroundColor Cyan");
            builder.AppendLine("  $__smCommand | Tee-Object -FilePath $__smLog -Append");
            builder.AppendLine($"  $__smExit = Invoke-SmStep {PsString(step.Script.LocalPath)} {PsString(step.Configuration.WorkingDirectory)} @({string.Join(", ", BuildArguments(step.Configuration).Select(PsString))}) $__smMarker");
            builder.AppendLine("  if ($__smExit -ne 0) {");
            builder.AppendLine("    Write-Host 'Step failed.' -ForegroundColor Red");
            builder.AppendLine("    if ($__smTryContinueEvenIfFail) {");
            builder.AppendLine("      $__smPromptStarted = Get-Date");
            builder.AppendLine("      $continueAfterFail = Read-Host 'Continue despite failure? Press Enter or type Y/yes to continue'");
            builder.AppendLine("      $__smPromptSeconds += ((Get-Date) - $__smPromptStarted).TotalSeconds");
            builder.AppendLine("      if ($continueAfterFail -notin @('', 'Y','y','YES','yes','Yes')) { $__smStop = $true }");
            builder.AppendLine("    } else { $__smStop = $true }");
            builder.AppendLine("  } else { Write-Host 'Step completed successfully.' -ForegroundColor Green }");
            builder.AppendLine("}");
        }
        AppendTerminalFooter(builder, options);
        await File.WriteAllTextAsync(wrapperPath, builder.ToString(), cancellationToken);
        return await RunWrapperAsync(wrapperPath, logPath, cancellationToken);
    }

    private async Task<(int ExitCode, string Output)> ExecuteVisibleAsync(Guid actionId, Guid logId, string actionName, ExecutionType type, string scriptPath, ScriptConfiguration configuration, RunExecutionOptions options, bool tryContinueEvenIfFail, CancellationToken cancellationToken)
    {
        var logPath = BuildOutputLogPath(options.OutputLogDirectory, logId, actionName, type);
        var wrapperPath = Path.Combine(Path.GetTempPath(), $"scriptmanager-{Guid.NewGuid():N}.ps1");
        var builder = new StringBuilder();
        AppendWrapperHeader(builder, logPath, type, actionName, actionId, logId);
        builder.AppendLine($"$__smTryContinueEvenIfFail = ${tryContinueEvenIfFail.ToString().ToLowerInvariant()}");
        builder.AppendLine($"$__smCommand = '> {EscapeForSingleQuoted(BuildCommand(scriptPath, configuration))}'");
        builder.AppendLine("Write-Host 'Starting script action...' -ForegroundColor Cyan");
        builder.AppendLine("Write-Host $__smCommand -ForegroundColor Cyan");
        builder.AppendLine("$__smCommand | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"if ({PsString(configuration.WorkingDirectory)} -and (Test-Path -LiteralPath {PsString(configuration.WorkingDirectory)})) {{ Push-Location -LiteralPath {PsString(configuration.WorkingDirectory)} }}");
        builder.AppendLine("try {");
        builder.AppendLine($"  & {PsString(scriptPath)} @({string.Join(", ", BuildArguments(configuration).Select(PsString))}) 2>&1 | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  $__smExit = $LASTEXITCODE; if ($null -eq $__smExit) { $__smExit = 0 }");
        builder.AppendLine("} catch { $_ | Tee-Object -FilePath $__smLog -Append; $__smExit = 1 }");
        builder.AppendLine($"finally {{ if ({PsString(configuration.WorkingDirectory)} -and (Test-Path -LiteralPath {PsString(configuration.WorkingDirectory)})) {{ Pop-Location }} }}");
        AppendTerminalFooter(builder, options);
        await File.WriteAllTextAsync(wrapperPath, builder.ToString(), cancellationToken);
        return await RunWrapperAsync(wrapperPath, logPath, cancellationToken);
    }

    private static async Task<(int ExitCode, string Output)> RunWrapperAsync(string wrapperPath, string logPath, CancellationToken cancellationToken)
    {
        var shell = CommandExists("pwsh") ? "pwsh" : "powershell";
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = shell,
            UseShellExecute = true,
            CreateNoWindow = false,
            ArgumentList = { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", wrapperPath }
        }) ?? throw new InvalidOperationException("Could not start terminal process.");
        await process.WaitForExitAsync(cancellationToken);
        var output = File.Exists(logPath) ? await File.ReadAllTextAsync(logPath, cancellationToken) : "";
        return (process.ExitCode, output);
    }

    private static void AppendTerminalFooter(StringBuilder builder, RunExecutionOptions options)
    {
        var delay = Math.Clamp(options.TerminalCloseDelaySeconds, 0, 3600);
        builder.AppendLine("} catch {");
        builder.AppendLine("  $_ | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  $__smExit = 1");
        builder.AppendLine("}");
        builder.AppendLine("$__smElapsed = (Get-Date) - $__smStarted");
        builder.AppendLine("$__smActionSeconds = [Math]::Max(0, $__smElapsed.TotalSeconds - $__smPromptSeconds)");
        builder.AppendLine("if ($__smExit -eq 0) {");
        builder.AppendLine("  Write-Host ''");
        builder.AppendLine("  Write-Host '============================================================' -ForegroundColor Green");
        builder.AppendLine("  Write-Host \"SCRIPT COMPLETED SUCCESSFULLY. Duration: $($__smElapsed.ToString())\" -ForegroundColor Green");
        builder.AppendLine("  Write-Host '============================================================' -ForegroundColor Green");
        builder.AppendLine("} else {");
        builder.AppendLine("  Write-Host ''");
        builder.AppendLine("  Write-Host '============================================================' -ForegroundColor Red");
        builder.AppendLine("  Write-Host \"SCRIPT FAILED OR WAS INTERRUPTED. Exit code: $__smExit. Duration: $($__smElapsed.ToString())\" -ForegroundColor Red");
        builder.AppendLine("  Write-Host '============================================================' -ForegroundColor Red");
        builder.AppendLine("}");
        builder.AppendLine("\"\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"============================================================\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"Finished: $(Get-Date -Format o)\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"Exit code: $__smExit\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"Total duration: $($__smElapsed.ToString())\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"Action duration excluding user confirmations: $([TimeSpan]::FromSeconds($__smActionSeconds).ToString())\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("\"============================================================\" | Tee-Object -FilePath $__smLog -Append");
        if (options.AutoCloseTerminalAfterRun)
        {
            builder.AppendLine($"Start-Sleep -Seconds {delay}");
        }
        else
        {
            builder.AppendLine("Read-Host 'Press Enter to close this terminal'");
        }
        builder.AppendLine("exit $__smExit");
    }

    private static void AppendWrapperHeader(StringBuilder builder, string logPath, ExecutionType type, string actionName, Guid actionId, Guid logId)
    {
        var terminal = CommandExists("pwsh") ? "pwsh" : "powershell";
        builder.AppendLine("$ErrorActionPreference = 'Continue'");
        builder.AppendLine($"$__smLog = {PsString(logPath)}");
        builder.AppendLine("$__smStarted = Get-Date");
        builder.AppendLine("$__smPromptSeconds = 0");
        builder.AppendLine("$__smExit = 0");
        builder.AppendLine("$__smStop = $false");
        builder.AppendLine("try {");
        builder.AppendLine("  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $__smLog) | Out-Null");
        builder.AppendLine("  \"============================================================\" | Tee-Object -FilePath $__smLog");
        builder.AppendLine("  \"ScriptManager execution\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  \"============================================================\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  \"Started: $($__smStarted.ToString('o'))\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"  \"Type: {type}\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"  \"Name: {EscapeForSingleQuoted(actionName)}\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"  \"ActionId: {actionId}\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"  \"LogId: {logId}\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine($"  \"Terminal: {terminal}\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  \"============================================================\" | Tee-Object -FilePath $__smLog -Append");
        builder.AppendLine("  Write-Host 'Starting ScriptManager action...' -ForegroundColor Cyan");
    }

    private string BuildOutputLogPath(string? configuredDirectory, Guid logId, string actionName, ExecutionType type)
    {
        var root = string.IsNullOrWhiteSpace(configuredDirectory) ? _paths.Logs : configuredDirectory.Trim();
        var directory = Path.Combine(root, "outputs");
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, $"{DateTime.Now:yyyyMMdd-HHmmss}-{type}-{SanitizeFileName(actionName)}-{logId:N}.log");
    }

    private static string SanitizeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars().ToHashSet();
        var sanitized = new string((value ?? "run").Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? "run" : sanitized;
    }

    private static ScriptConfiguration ResolveConfiguration(ScriptRecord script, Guid? configurationId)
    {
        if (configurationId is not null && configurationId.Value != Guid.Empty)
        {
            return script.Configurations.FirstOrDefault(x => x.Id == configurationId.Value) ?? throw new InvalidOperationException("Configuration not found.");
        }

        return script.Configurations.OrderBy(x => x.Order).FirstOrDefault() ?? new ScriptConfiguration
        {
            Name = "Ad hoc",
            WorkingDirectory = !string.IsNullOrWhiteSpace(script.OriginalPath) ? Path.GetDirectoryName(script.OriginalPath) ?? Environment.CurrentDirectory : Environment.CurrentDirectory
        };
    }

    private static IEnumerable<string> BuildArguments(ScriptConfiguration configuration)
    {
        foreach (var parameter in configuration.Parameters.Where(x => !string.IsNullOrWhiteSpace(x.Name)))
        {
            if (string.IsNullOrEmpty(parameter.Value))
            {
                yield return parameter.Name;
            }
            else
            {
                yield return "-" + parameter.Name;
                yield return parameter.Value;
            }
        }
    }

    private static string FormatParameter(ScriptParameter parameter)
    {
        if (string.IsNullOrWhiteSpace(parameter.Name))
        {
            return "";
        }

        return string.IsNullOrEmpty(parameter.Value)
            ? QuoteArgument(parameter.Name)
            : $"-{QuoteArgument(parameter.Name)} {QuoteArgument(parameter.Value)}";
    }

    private static string QuoteArgument(string value)
    {
        return value.Any(char.IsWhiteSpace) || value.Contains('"')
            ? $"\"{value.Replace("\"", "\\\"")}\""
            : value;
    }

    private static string PsString(string value) => $"'{EscapeForSingleQuoted(value ?? "")}'";

    private static string EscapeForSingleQuoted(string value) => (value ?? "").Replace("'", "''");

    private static int ExtractStepExitCode(string output, string marker)
    {
        var line = output.Split(["\r\n", "\n"], StringSplitOptions.None).LastOrDefault(x => x.StartsWith(marker, StringComparison.Ordinal));
        return line is not null && int.TryParse(line[marker.Length..].Trim(), out var exitCode) ? exitCode : 0;
    }

    private static string DescribeSpecialStep(AutomationStep step) => step.Kind switch
    {
        AutomationStepKind.Delay => $"Delay {step.DelayMilliseconds} ms",
        AutomationStepKind.ContinueConfirmation => "Continue confirmation",
        AutomationStepKind.CustomOutput => $"Write-Host \"{step.OutputText}\" -ForegroundColor {step.OutputColor}",
        _ => step.Kind.ToString()
    };

    private static void AppendSpecialStep(StringBuilder builder, AutomationStep step)
    {
        builder.AppendLine("if (-not $__smStop) {");
        if (step.Kind == AutomationStepKind.Delay)
        {
            builder.AppendLine($"  Start-Sleep -Milliseconds {Math.Max(1, step.DelayMilliseconds)}");
        }
        else if (step.Kind == AutomationStepKind.ContinueConfirmation)
        {
            builder.AppendLine("  $confirmation = Read-Host 'Continue automation? Type Y and press Enter to continue'");
            builder.AppendLine("  if ($confirmation -notin @('Y','y','YES','yes')) { $__smExit = 130; $__smStop = $true }");
        }
        else if (step.Kind == AutomationStepKind.CustomOutput)
        {
            builder.AppendLine($"  Write-Host {PsString(step.OutputText)} -ForegroundColor {NormalizeTerminalColor(step.OutputColor)}");
            builder.AppendLine($"  {PsString(step.OutputText)} | Tee-Object -FilePath $__smLog -Append");
        }
        builder.AppendLine("}");
    }

    private static string NormalizeTerminalColor(string color)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Black", "DarkBlue", "DarkGreen", "DarkCyan", "DarkRed", "DarkMagenta", "DarkYellow", "Gray",
            "DarkGray", "Blue", "Green", "Cyan", "Red", "Magenta", "Yellow", "White"
        };
        return allowed.Contains(color) ? color : "White";
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

public sealed record PreparedCommand(
    Guid ScriptId,
    Guid ConfigurationId,
    string ScriptName,
    string ConfigurationName,
    string WorkingDirectory,
    string CommandLine);

public sealed record RunExecutionOptions(
    bool AutoCloseTerminalAfterRun,
    int TerminalCloseDelaySeconds,
    bool ShouldWaitBetweenScripts,
    int WaitBetweenScriptsMilliseconds,
    bool ConfirmationBetweenScripts,
    string OutputLogDirectory = "",
    bool TryContinueEvenIfFail = false)
{
    public static RunExecutionOptions Default { get; } = new(true, 30, false, 1000, false);
}
