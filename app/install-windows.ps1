# Installs Operator Tool Kit as a desktop app on Windows: copies it into your user folder and adds Start menu and desktop
# shortcuts that open it in its own window (Microsoft Edge or Google Chrome app mode). Nothing needs the internet.
# "Install on Windows.cmd" runs this. Run it again to install a newer copy; Uninstall.cmd in the install folder removes it.
param([string]$Dest = (Join-Path $env:LOCALAPPDATA 'Operator Tool Kit'),
      [string]$StartMenu = [Environment]::GetFolderPath('Programs'),
      [string]$Desktop = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
foreach ($f in 'Operator Tool Kit.html', 'icon.ico', 'icon.png') { Copy-Item -LiteralPath (Join-Path $src $f) -Destination $Dest -Force }
$html = Join-Path $Dest 'Operator Tool Kit.html'; $ico = Join-Path $Dest 'icon.ico'
$url = ([Uri]$html).AbsoluteUri
# Edge comes with Windows 10 and 11; Chrome is used if Edge is missing
$browser = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
             "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
             "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
$shell = New-Object -ComObject WScript.Shell
$made = @()
foreach ($dir in @($StartMenu, $Desktop)) {
    if (-not $dir) { continue }
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $path = Join-Path $dir 'Operator Tool Kit.lnk'
    $lnk = $shell.CreateShortcut($path)
    if ($browser) { $lnk.TargetPath = $browser; $lnk.Arguments = "--app=`"$url`"" } else { $lnk.TargetPath = $html }
    $lnk.WorkingDirectory = $Dest; $lnk.IconLocation = "$ico,0"; $lnk.Description = 'Operator Tool Kit'
    $lnk.Save(); $made += $path
}
# An uninstaller next to the app: removes the shortcuts, then the folder it sits in
$un = @('@echo off', 'echo Removing Operator Tool Kit...') + @($made | ForEach-Object { "del `"$_`" 2>nul" }) + @('echo Done.', 'pause', "(goto) 2>nul & rmdir /s /q `"$Dest`"")
$oem = [Text.Encoding]::GetEncoding([Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage)
[IO.File]::WriteAllText((Join-Path $Dest 'Uninstall.cmd'), ($un -join "`r`n") + "`r`n", $oem)
Write-Host ''
Write-Host 'Operator Tool Kit is installed.' -ForegroundColor Green
Write-Host ('Open it from the Start menu or the desktop icon. It opens in its own window' + $(if ($browser) { ' (' + [IO.Path]::GetFileNameWithoutExtension($browser) + ' app mode).' } else { ' in your browser.' }))
Write-Host "Installed in $Dest (Uninstall.cmd there removes it)."
