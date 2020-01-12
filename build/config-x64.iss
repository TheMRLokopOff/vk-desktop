[Setup]
AppId=VKDesktop
AppName=VK Desktop
AppVersion=0.2.0-beta.2
AppPublisher=danyadev
AppPublisherURL=https://vk.com/danyadev
AppSupportURL=https://vk.com/vk_desktop_app
AppUpdatesURL=https://github.com/danyadev/vk-desktop/releases
DefaultDirName={pf}\VK Desktop
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\out
OutputBaseFilename=VK-Desktop-Setup-x64
SetupIconFile=.\icon.ico
UninstallDisplayIcon={app}\VK Desktop.exe
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\out\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs allowunsafefiles

[Icons]
Name: "{commonprograms}\VK Desktop"; Filename: "{app}\VK Desktop.exe"
Name: "{commondesktop}\VK Desktop"; Filename: "{app}\VK Desktop.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\VK Desktop.exe"; Description: "{cm:LaunchProgram,VK Desktop}"; Flags: nowait postinstall skipifsilent
