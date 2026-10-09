Option Explicit

Dim shell, files, appPath
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
appPath = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "src-tauri\target\release\lifeos.exe")

If files.FileExists(appPath) Then
  shell.Run Chr(34) & appPath & Chr(34), 1, False
Else
  MsgBox "LifeOS 尚未构建，请先运行：npm run tauri build", 48, "LifeOS"
End If
