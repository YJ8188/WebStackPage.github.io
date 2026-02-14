[Setup]
AppId={{F1E8CE24-9E35-48E9-9D1F-8F5D3E86FA09}
AppName=WebStack Card Manager
AppVersion=1.1.0
AppPublisher=YJ8188
DefaultDirName={autopf}\WebStack Card Manager
DefaultGroupName=WebStack Card Manager
OutputDir=dist-installer
OutputBaseFilename=WebStackCardManager-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "dist\WebStackCardManager.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\WebStack Card Manager"; Filename: "{app}\WebStackCardManager.exe"
Name: "{autodesktop}\WebStack Card Manager"; Filename: "{app}\WebStackCardManager.exe"

[Run]
Filename: "{app}\WebStackCardManager.exe"; Description: "启动 WebStack Card Manager"; Flags: nowait postinstall skipifsilent

