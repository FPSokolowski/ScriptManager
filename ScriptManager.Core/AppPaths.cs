namespace ScriptManager.Core;

public sealed class AppPaths
{
    public AppPaths(string root)
    {
        Root = root;
        Scripts = Path.Combine(root, "scripts");
        Backups = Path.Combine(root, "backups");
        Logs = Path.Combine(root, "logs");
        DatabasePath = Path.Combine(root, "scriptmanager.db");
    }

    public string Root { get; }
    public string Scripts { get; }
    public string Backups { get; }
    public string Logs { get; }
    public string DatabasePath { get; }

    public static AppPaths ForCurrentUser()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ScriptManager");
        return new AppPaths(root);
    }

    public void Ensure()
    {
        Directory.CreateDirectory(Root);
        Directory.CreateDirectory(Scripts);
        Directory.CreateDirectory(Backups);
        Directory.CreateDirectory(Logs);
    }
}
