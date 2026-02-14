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
Name: "{group}\WebStack Desktop（运行版）"; Filename: "{app}\WebStackDesktop.exe"
Name: "{group}\WebStack Manager（管理器）"; Filename: "{app}\WebStackManager.exe"
Name: "{autodesktop}\WebStack Desktop"; Filename: "{app}\WebStackDesktop.exe"

[Run]
Filename: "{app}\WebStackDesktop.exe"; Description: "启动 WebStack Desktop（运行版）"; Flags: nowait postinstall skipifsilent

