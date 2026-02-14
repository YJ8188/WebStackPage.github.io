[Setup]
AppId={{F1E8CE24-9E35-48E9-9D1F-8F5D3E86FA09}
AppName=WebStack Desktop Suite
AppVersion=1.2.0
AppPublisher=YJ8188
DefaultDirName={autopf}\WebStack Desktop Suite
DefaultGroupName=WebStack Desktop Suite
OutputDir=dist-installer
OutputBaseFilename=WebStackDesktopSuite-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "dist\WebStackDesktop.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\WebStackManager.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\WebStack Suite（运行+管理一体）"; Filename: "{app}\WebStackManager.exe"
Name: "{group}\WebStack Desktop（运行版）"; Filename: "{app}\WebStackDesktop.exe"
Name: "{group}\WebStack Manager（管理器）"; Filename: "{app}\WebStackManager.exe"
Name: "{autodesktop}\WebStack Suite"; Filename: "{app}\WebStackManager.exe"

[Run]
Filename: "{app}\WebStackManager.exe"; Description: "启动 WebStack Suite（运行+管理一体）"; Flags: nowait postinstall skipifsilent
