[Setup]
AppId={{F1E8CE24-9E35-48E9-9D1F-8F5D3E86FA09}
AppName=WebStack Manager
AppVersion=1.2.0
AppPublisher=YJ8188
DefaultDirName={autopf}\WebStack Manager
DefaultGroupName=WebStack Manager
OutputDir=dist-installer
OutputBaseFilename=WebStackManager-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "dist\WebStackManager.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\WebStack Manager"; Filename: "{app}\WebStackManager.exe"
Name: "{autodesktop}\WebStack Manager"; Filename: "{app}\WebStackManager.exe"

[Run]
Filename: "{app}\WebStackManager.exe"; Description: "启动 WebStack Manager"; Flags: nowait postinstall skipifsilent

