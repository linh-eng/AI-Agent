' Chay start-server.bat o che do AN (khong hien cua so den) - dung cho tu khoi dong.
Dim fso, shell, here
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = here
shell.Run """" & here & "\start-server.bat""", 0, False
